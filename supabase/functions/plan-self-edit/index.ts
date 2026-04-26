// Plans a single-file edit to the SARVIS frontend codebase.
// Input: { request, currentPath?, currentContent? }
// Output: { ok, plan: { path, newContent, explanation, refused } }
//
// The actual write happens via the local backend's /api/file/write after the
// user confirms the diff in the UI.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request, currentPath, currentContent } = await req.json();
    if (typeof request !== "string" || !request.trim()) {
      return new Response(JSON.stringify({ error: "'request' is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileSection = currentPath && typeof currentContent === "string"
      ? `Target file path (already supplied): ${currentPath}

Current file contents:
\`\`\`
${currentContent.slice(0, 30000)}
\`\`\``
      : "No file was pre-selected. Pick the most likely file in the SARVIS frontend (paths begin with src/...).";

    const systemPrompt = `You are SARVIS Self-Editor. The user wants to modify the SARVIS app's own source code.
The codebase is a React + TypeScript + Vite + Tailwind app rooted at the project root. Frontend lives under src/.
Common files: src/pages/Index.tsx, src/components/SettingsDialog.tsx, src/components/ChatSidebar.tsx, src/index.css, tailwind.config.ts.

Rules:
- Output the FULL new content of exactly one file.
- Preserve imports, exports, and TypeScript correctness.
- Do not touch src/integrations/supabase/types.ts, .env, or any lockfile.
- If the request is unclear, dangerous, or out of scope, set refused:true with an explanation and leave path/newContent empty.
- Keep changes minimal and targeted. Do not reformat the whole file.`;

    const userMessage = `Request: ${request}

${fileSection}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "edit_file",
              description: "Return the path and new full content of the file to edit.",
              parameters: {
                type: "object",
                properties: {
                  path: { type: "string", description: "Repo-relative file path, e.g. src/components/SettingsDialog.tsx" },
                  newContent: { type: "string", description: "Full new content of the file." },
                  explanation: { type: "string", description: "1-2 sentence summary of the change." },
                  refused: { type: "boolean", description: "True if the edit was refused." },
                  refuseReason: { type: "string", description: "Reason if refused." },
                },
                required: ["path", "newContent", "explanation", "refused"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "edit_file" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("plan-self-edit gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Model did not return an edit" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Model returned invalid JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, plan: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plan-self-edit error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
