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
      ? `PowerShell 5/7 on Windows.
- Package install order: winget → choco → scoop. Use winget by ID when known (e.g. "winget install -e --id Google.Chrome").
- Launch apps: 'Start-Process chrome', 'Start-Process notepad', 'Start-Process ms-settings:'.
- Power: shutdown /s /t 0, shutdown /r /t 0, rundll32.exe powrprof.dll,SetSuspendState 0,1,0, rundll32.exe user32.dll,LockWorkStation, shutdown /l.
- Info: Get-NetIPAddress, Get-Process, Get-PSDrive, Get-CimInstance Win32_OperatingSystem.
- Audio (need NirCmd or SoundVolumeView for exact level): basic mute via SendKeys [char]173.
- Screenshot: Add-Type -AssemblyName System.Windows.Forms ; [Windows.Forms.SendKeys]::SendWait('+{PRTSC}').`
      : targetOs === "macos"
        ? `zsh on macOS.
- Package install: Homebrew first ('brew install X', GUI apps via 'brew install --cask X'). Fall back to mas-cli for App Store apps.
- Launch apps: 'open -a "Google Chrome"', 'open -a Terminal', 'open <URL>'.
- Power: 'osascript -e "tell application \\"System Events\\" to shut down"', restart, sleep, log out. Lock: pmset displaysleepnow OR 'osascript -e "tell application \\"System Events\\" to keystroke \\"q\\" using {command down, control down}"'.
- Info: 'system_profiler SPHardwareDataType', 'top -l 1', 'df -h', 'pmset -g batt', 'ifconfig'.
- Audio: 'osascript -e "set volume output volume N"' (0-100).
- Screenshot: 'screencapture ~/Desktop/screenshot-$(date +%s).png'.`
        : `bash on Linux (assume Debian/Ubuntu/Kali — apt available, but also know dnf/pacman/zypper).
- Package install order: apt → snap → flatpak. Use 'sudo apt update && sudo apt install -y X'. For Chrome/Edge/Code, fetch the .deb from the vendor and 'apt install ./pkg.deb' OR add the official apt repo.
- Launch apps: nohup <app> >/dev/null 2>&1 & disown — never block the shell. xdg-open <url>.
- Terminals to try in order: x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, xterm.
- Power: 'systemctl poweroff', 'systemctl reboot', 'systemctl suspend', 'systemctl hibernate'. Lock: 'loginctl lock-session' or 'gnome-screensaver-command -l' or 'xdg-screensaver lock'. Logout: 'gnome-session-quit --logout --no-prompt'.
- Info: free -h, df -h, uptime, hostnamectl, ip a, nmcli dev wifi, upower -i $(upower -e | grep BAT), ps aux --sort=-%mem | head, lsblk.
- Audio: 'pactl set-sink-volume @DEFAULT_SINK@ N%' / 'pactl set-sink-mute @DEFAULT_SINK@ 1'. Brightness: 'brightnessctl set N%'.
- Screenshot: 'gnome-screenshot -f ~/screenshot-$(date +%s).png' or scrot/flameshot if present.
- Media: 'playerctl play-pause', 'playerctl next/previous'.
- Network test: 'ping -c 4 1.1.1.1', 'curl -s ifconfig.me', 'dig +short example.com'.
- File ops: prefer mkdir -p, rm -i (interactive), cp -r, mv. NEVER 'rm -rf /' or anything starting at /.`;

    const systemPrompt = `You are SARVIS Command Planner — the JARVIS-style executor for the user's machine.
The user describes what they want done in natural language. You MUST output a small ordered list of REAL shell commands that accomplish the task on ${targetOs}.

Shell context:
${shellHint}

Rules:
- Output 1-6 commands max. Keep each command on a single line.
- Combine related steps when sensible (e.g. "sudo apt update && sudo apt install -y X").
- For installs that need keys/repos (Chrome on Linux, Docker, VS Code, etc.), include the full setup commands in order (curl key | sudo gpg --dearmor → echo deb ... → apt update → apt install).
- For "open <app>" requests, prefer launching the installed binary; if it's not commonly installed, include an install step first guarded by a check (e.g. 'command -v code || sudo apt install -y code').
- For info queries ("show my battery", "what's my IP"), pick the single best command for that distro/OS.
- For power commands (shutdown/restart/sleep/lock/logout), output the canonical command directly — they are needsConfirm:true but NOT refused.
- Never invent flags. Only use real, well-known commands.
- For Windows, write PowerShell (not cmd). Quote paths containing spaces.
- Mark a command as needsConfirm:true if it: uses sudo, modifies system files, installs/removes packages, changes services, shuts down/restarts/logs out, or could affect other apps.
- If the request is dangerous or destructive (rm -rf /, format disk, fork bomb, dd to /dev/sdX), refuse and return an empty commands array with an explanation.
- If a previous attempt failed, analyse the error and return a corrected command list (e.g. add missing repo, fix package name, switch installer).`;

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
