// Turns a natural-language request like "install google chrome" into a list of
// concrete shell commands for the user's OS. Uses Lovable AI tool-calling for
// reliable structured output. Also used to fix errors after a failed run.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_OS = new Set(["linux", "macos", "windows"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { request, os: rawOs, previousAttempt } = body ?? {};

    if (typeof request !== "string" || request.trim().length === 0) {
      return new Response(JSON.stringify({ error: "'request' is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const targetOs = ALLOWED_OS.has(rawOs) ? rawOs : "linux";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shellHint = targetOs === "windows"
      ? "PowerShell on Windows. Prefer winget; fall back to choco or scoop."
      : targetOs === "macos"
        ? "zsh/bash on macOS. Prefer Homebrew (brew). Use 'brew install --cask' for GUI apps."
        : "bash on Linux (assume Debian/Ubuntu/Kali — apt available). Use sudo where needed. Prefer 'apt install -y'.";

    const systemPrompt = `You are SARVIS Command Planner. The user describes what they want done on their computer.
You MUST output a small ordered list of real shell commands that accomplish the task on ${targetOs}.

Shell context: ${shellHint}

Rules:
- Output 1-6 commands max. Keep each command on a single line.
- Combine related steps when sensible (e.g. "sudo apt update && sudo apt install -y X").
- For installs that need keys/repos (Chrome on Linux, Docker, etc.), include the full setup commands in order.
- Never invent flags. Only use real, well-known commands.
- For Windows, write PowerShell (not cmd).
- Mark a command as needsConfirm:true if it uses sudo, modifies system files, installs/removes packages, or could affect other apps.
- If the request is dangerous or destructive (rm -rf /, format disk, etc.), refuse and return an empty commands array with an explanation.
- If a previous attempt failed, analyse the error and return a corrected command list.`;

    const userMessage = previousAttempt
      ? `Original request: ${request}

Previous command that ran:
\`\`\`
${previousAttempt.cmd ?? ""}
\`\`\`
Exit code: ${previousAttempt.code ?? "?"}
stdout:
${(previousAttempt.output ?? "").slice(0, 2000)}
stderr:
${(previousAttempt.error ?? "").slice(0, 2000)}

Please return a corrected command list that fixes this error. If it cannot be fixed automatically, explain why and return an empty commands array.`
      : `Request: ${request}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "plan",
              description: "Return the ordered list of shell commands to run on the user's machine.",
              parameters: {
                type: "object",
                properties: {
                  explanation: {
                    type: "string",
                    description: "1-2 sentence summary of what these commands will do.",
                  },
                  commands: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        cmd: { type: "string", description: "Exact shell command to execute." },
                        why: { type: "string", description: "Short reason for this step." },
                        needsConfirm: {
                          type: "boolean",
                          description: "True if this step modifies the system or installs software.",
                        },
                      },
                      required: ["cmd", "why", "needsConfirm"],
                      additionalProperties: false,
                    },
                  },
                  refused: {
                    type: "boolean",
                    description: "True if the request was refused (dangerous / impossible).",
                  },
                },
                required: ["explanation", "commands", "refused"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "plan" } },
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
      console.error("plan-command gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Model did not return a plan" }), {
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

    return new Response(JSON.stringify({ ok: true, os: targetOs, plan: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plan-command error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
