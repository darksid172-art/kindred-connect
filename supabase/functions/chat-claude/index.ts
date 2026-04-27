// Anthropic Claude streaming chat. Used as a fallback when Lovable AI Gateway
// runs out of credits, or when the user explicitly selects a Claude model.
// Body: { messages: [{role:'user'|'assistant', content}], systemPrompt?, model? }
// Streams SSE in OpenAI-compatible format so the existing client parser works.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT =
  'You are SARVIS, an advanced AI assistant. Your display name is the single word "SARVIS". When asked your name, reply briefly such as "My name is SARVIS. How can I help you today?". Never spell the name letter-by-letter and never add pronunciation hints. Be helpful, concise, and conversational. Use markdown when it improves clarity.';

const ALLOWED = new Set([
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
  "claude-3-haiku-20240307",
  "claude-sonnet-4-5",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, model, systemPrompt } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages must be a non-empty array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured. Add it in Lovable Cloud secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const safeModel = typeof model === "string" && ALLOWED.has(model) ? model : "claude-3-5-haiku-latest";
    const safePrompt =
      typeof systemPrompt === "string" && systemPrompt.trim().length > 0
        ? systemPrompt.trim().slice(0, 8000)
        : DEFAULT_SYSTEM_PROMPT;

    // Anthropic only allows user/assistant roles (no system in array).
    const cleanMessages = messages
      .filter((m: { role: string; content: string }) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: safeModel,
        system: safePrompt,
        messages: cleanMessages,
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text();
      console.error("Anthropic error", upstream.status, t);
      return new Response(JSON.stringify({ error: `Anthropic ${upstream.status}: ${t.slice(0, 200)}` }), {
        status: upstream.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Translate Anthropic SSE → OpenAI-style chunks.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const send = (delta: string) => {
          const payload = { choices: [{ delta: { content: delta } }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const evt = JSON.parse(data);
                if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                  send(evt.delta.text ?? "");
                } else if (evt.type === "message_stop") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch {
                // ignore partial
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          console.error("claude stream error", e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-claude error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
