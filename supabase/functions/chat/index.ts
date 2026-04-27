const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT =
  'You are SARVIS, an advanced AI assistant. Your display name is the single word "SARVIS" — always write it exactly as "SARVIS". When asked your name, reply briefly such as "My name is SARVIS. How can I help you today?". STRICT RULES: NEVER add pronunciation hints in any form. NEVER write "(pronounced ...)", "pronounced as", "pronounced like", "say it like", "sounds like", or any phonetic guide. NEVER spell the name letter-by-letter (no "S A R V I S", "S.A.R.V.I.S", "S-A-R-V-I-S"). The pronunciation is handled silently by the speech engine — do not mention it in text. Be helpful, concise, and conversational. Use markdown when it improves clarity.';

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const ALLOWED_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
  "openai/gpt-5-nano",
  "openai/gpt-5-mini",
  "openai/gpt-5",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model, systemPrompt } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeModel = typeof model === "string" && ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
    const safePrompt =
      typeof systemPrompt === "string" && systemPrompt.trim().length > 0
        ? systemPrompt.trim().slice(0, 4000)
        : DEFAULT_SYSTEM_PROMPT;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: safeModel,
        messages: [{ role: "system", content: safePrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // On 402 (credits exhausted) auto-fallback to Anthropic Claude server-side
      // so the user never sees a credit-exhausted runtime error.
      if (response.status === 402) {
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        if (ANTHROPIC_API_KEY) {
          try {
            const claudeMsgs = (messages as { role: string; content: string }[])
              .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
              .map((m) => ({ role: m.role, content: m.content }));
            const cResp = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-3-5-haiku-latest",
                system: safePrompt,
                messages: claudeMsgs,
                max_tokens: 1024,
                stream: true,
              }),
            });
            if (cResp.ok && cResp.body) {
              // Translate Anthropic SSE → OpenAI-style chunks
              const encoder = new TextEncoder();
              const stream = new ReadableStream({
                async start(controller) {
                  const reader = cResp.body!.getReader();
                  const decoder = new TextDecoder();
                  let buf = "";
                  const send = (delta: string) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`));
                  };
                  try {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      buf += decoder.decode(value, { stream: true });
                      let nl: number;
                      while ((nl = buf.indexOf("\n")) !== -1) {
                        const line = buf.slice(0, nl).trim();
                        buf = buf.slice(nl + 1);
                        if (!line.startsWith("data:")) continue;
                        const d = line.slice(5).trim();
                        if (!d || d === "[DONE]") continue;
                        try {
                          const evt = JSON.parse(d);
                          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                            send(evt.delta.text ?? "");
                          }
                        } catch { /* partial */ }
                      }
                    }
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                  } catch (err) {
                    console.error("claude fallback stream error", err);
                    controller.error(err);
                  }
                },
              });
              return new Response(stream, {
                headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
              });
            }
            console.error("Claude fallback not ok", cResp.status, await cResp.text());
          } catch (err) {
            console.error("Claude fallback threw", err);
          }
        }
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
