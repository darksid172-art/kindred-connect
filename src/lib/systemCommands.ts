// JARVIS-style system command builder.
// Generates real shell/script snippets for the user's chosen OS.

export type OS = "linux" | "windows" | "macos";

export interface CommandResult {
  title: string;
  description: string;
  language: "bash" | "powershell" | "applescript" | "batch";
  filename: string;
  code: string;
  speak: string; // friendly JARVIS-style line
}

function script(os: OS, body: { bash?: string; powershell?: string; applescript?: string }) {
  if (os === "linux") return { lang: "bash" as const, code: body.bash ?? "echo 'unsupported on linux'", ext: "sh" };
  if (os === "windows") return { lang: "powershell" as const, code: body.powershell ?? "Write-Host 'unsupported on windows'", ext: "ps1" };
  return { lang: "applescript" as const, code: body.applescript ?? body.bash ?? "say \"unsupported on macOS\"", ext: "scpt" };
}

function build(os: OS, title: string, description: string, body: Parameters<typeof script>[1], speak: string): CommandResult {
  const s = script(os, body);
  return {
    title,
    description,
    language: s.lang,
    filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${s.ext}`,
    code: s.code,
    speak,
  };
}

// All supported slash commands. Keep this list in sync with COMMAND_HELP.
export const COMMANDS = [
  "/terminal", "/chrome", "/firefox", "/edge", "/browser",
  "/settings", "/files", "/explorer", "/finder",
  "/restart", "/shutdown", "/sleep", "/lock", "/logout",
  "/open", "/search", "/play", "/pause", "/volume",
  "/screenshot", "/notepad", "/calculator", "/calc",
  "/wifi", "/bluetooth", "/ip", "/ping", "/whoami", "/date",
  "/news", "/weather", "/youtube", "/gmail", "/maps",
  "/mute", "/unmute", "/brightness", "/clipboard",
  "/kill", "/processes", "/uptime", "/disk", "/battery",
] as const;

export type SlashCommand = typeof COMMANDS[number];

export function isSlashCommand(text: string): boolean {
  const head = text.trim().split(/\s+/)[0]?.toLowerCase();
  return !!head && (COMMANDS as readonly string[]).includes(head);
}

export function parseSlash(text: string): { cmd: string; arg: string } {
  const trimmed = text.trim();
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { cmd: trimmed.toLowerCase(), arg: "" };
  return { cmd: trimmed.slice(0, idx).toLowerCase(), arg: trimmed.slice(idx + 1).trim() };
}

export function buildCommand(os: OS, raw: string): CommandResult {
  const { cmd, arg } = parseSlash(raw);
  const url = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);
  const search = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

  switch (cmd) {
    case "/terminal":
      return build(os, "Open Terminal", "Launches your default terminal.", {
        bash: `# Linux\n(x-terminal-emulator || gnome-terminal || konsole || xterm) &`,
        powershell: `Start-Process wt.exe -ErrorAction SilentlyContinue; if ($?) { exit }; Start-Process powershell.exe`,
        applescript: `tell application "Terminal" to activate`,
      }, "Opening the terminal, sir.");

    case "/chrome":
      return build(os, "Open Chrome", "Launches Google Chrome.", {
        bash: `google-chrome ${arg ? url(arg) : ""} & disown`,
        powershell: `Start-Process "chrome.exe" "${arg ? url(arg) : ""}"`,
        applescript: `tell application "Google Chrome" to activate\n${arg ? `tell application "Google Chrome" to open location "${url(arg)}"` : ""}`,
      }, arg ? `Opening ${arg} in Chrome.` : "Launching Chrome.");

    case "/firefox":
      return build(os, "Open Firefox", "Launches Firefox.", {
        bash: `firefox ${arg ? url(arg) : ""} & disown`,
        powershell: `Start-Process "firefox.exe" "${arg ? url(arg) : ""}"`,
        applescript: `tell application "Firefox" to activate`,
      }, "Launching Firefox.");

    case "/edge":
      return build(os, "Open Edge", "Launches Microsoft Edge.", {
        bash: `microsoft-edge ${arg ? url(arg) : ""} & disown`,
        powershell: `Start-Process "msedge.exe" "${arg ? url(arg) : ""}"`,
        applescript: `tell application "Microsoft Edge" to activate`,
      }, "Launching Edge.");

    case "/browser":
    case "/open": {
      const target = arg || "https://www.google.com";
      return build(os, `Open ${target}`, "Opens a URL in your default browser.", {
        bash: `xdg-open "${url(target)}"`,
        powershell: `Start-Process "${url(target)}"`,
        applescript: `open location "${url(target)}"`,
      }, `Opening ${target}.`);
    }

    case "/search": {
      const q = arg || "site:lovable.dev";
      return build(os, `Search: ${q}`, "Opens a Google search.", {
        bash: `xdg-open "${search(q)}"`,
        powershell: `Start-Process "${search(q)}"`,
        applescript: `open location "${search(q)}"`,
      }, `Searching the web for ${q}.`);
    }

    case "/youtube": {
      const q = arg ? `https://www.youtube.com/results?search_query=${encodeURIComponent(arg)}` : "https://www.youtube.com";
      return build(os, "YouTube", "Opens YouTube.", {
        bash: `xdg-open "${q}"`,
        powershell: `Start-Process "${q}"`,
        applescript: `open location "${q}"`,
      }, arg ? `Searching YouTube for ${arg}.` : "Opening YouTube.");
    }

    case "/gmail":
      return build(os, "Gmail", "Opens Gmail.", {
        bash: `xdg-open "https://mail.google.com"`,
        powershell: `Start-Process "https://mail.google.com"`,
        applescript: `open location "https://mail.google.com"`,
      }, "Opening Gmail.");

    case "/maps": {
      const m = arg ? `https://www.google.com/maps/search/${encodeURIComponent(arg)}` : "https://www.google.com/maps";
      return build(os, "Maps", "Opens Google Maps.", {
        bash: `xdg-open "${m}"`,
        powershell: `Start-Process "${m}"`,
        applescript: `open location "${m}"`,
      }, arg ? `Mapping ${arg}.` : "Opening Maps.");
    }

    case "/news":
      return build(os, "News", "Opens Google News.", {
        bash: `xdg-open "https://news.google.com"`,
        powershell: `Start-Process "https://news.google.com"`,
        applescript: `open location "https://news.google.com"`,
      }, "Pulling up the latest news.");

    case "/weather": {
      const w = `https://www.google.com/search?q=weather+${encodeURIComponent(arg || "")}`;
      return build(os, "Weather", "Opens current weather.", {
        bash: `xdg-open "${w}"`,
        powershell: `Start-Process "${w}"`,
        applescript: `open location "${w}"`,
      }, arg ? `Checking weather in ${arg}.` : "Checking the weather.");
    }

    case "/settings":
      return build(os, "Open Settings", "Opens system settings.", {
        bash: `gnome-control-center & disown || xdg-open "settings://"`,
        powershell: `Start-Process "ms-settings:"`,
        applescript: `tell application "System Preferences" to activate`,
      }, "Opening system settings.");

    case "/files":
    case "/explorer":
    case "/finder":
      return build(os, "Open Files", "Opens the file manager.", {
        bash: `xdg-open "${arg || "$HOME"}"`,
        powershell: `Start-Process explorer.exe "${arg || "$env:USERPROFILE"}"`,
        applescript: `tell application "Finder" to activate`,
      }, "Opening files.");

    case "/restart":
      return build(os, "Restart Computer", "⚠️ Reboots the system.", {
        bash: `# Will prompt for password\nsudo shutdown -r now`,
        powershell: `# Run as administrator\nshutdown /r /t 0`,
        applescript: `tell application "System Events" to restart`,
      }, "Restarting the system.");

    case "/shutdown":
      return build(os, "Shutdown Computer", "⚠️ Powers off the system.", {
        bash: `sudo shutdown -h now`,
        powershell: `shutdown /s /t 0`,
        applescript: `tell application "System Events" to shut down`,
      }, "Powering down. Goodbye, sir.");

    case "/sleep":
      return build(os, "Sleep", "Puts the computer to sleep.", {
        bash: `systemctl suspend`,
        powershell: `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)`,
        applescript: `tell application "System Events" to sleep`,
      }, "Going to sleep.");

    case "/lock":
      return build(os, "Lock Screen", "Locks the desktop.", {
        bash: `loginctl lock-session || gnome-screensaver-command -l`,
        powershell: `rundll32.exe user32.dll,LockWorkStation`,
        applescript: `tell application "System Events" to keystroke "q" using {command down, control down}`,
      }, "Locking the screen.");

    case "/logout":
      return build(os, "Log Out", "Signs the user out.", {
        bash: `gnome-session-quit --logout --no-prompt`,
        powershell: `shutdown /l`,
        applescript: `tell application "System Events" to log out`,
      }, "Signing out.");

    case "/screenshot":
      return build(os, "Screenshot", "Captures the screen.", {
        bash: `gnome-screenshot -f "$HOME/screenshot-$(date +%s).png"`,
        powershell: `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('+{PRTSC}')`,
        applescript: `do shell script "screencapture ~/Desktop/screenshot-$(date +%s).png"`,
      }, "Taking a screenshot.");

    case "/notepad":
      return build(os, "Open Notepad", "Opens a basic text editor.", {
        bash: `gedit & disown || xdg-open /tmp/note.txt`,
        powershell: `Start-Process notepad.exe`,
        applescript: `tell application "TextEdit" to activate`,
      }, "Opening notes.");

    case "/calc":
    case "/calculator":
      return build(os, "Calculator", "Opens the calculator app.", {
        bash: `gnome-calculator & disown`,
        powershell: `Start-Process calc.exe`,
        applescript: `tell application "Calculator" to activate`,
      }, "Calculator ready.");

    case "/wifi":
      return build(os, "Wi-Fi Status", "Shows wireless network info.", {
        bash: `nmcli device wifi list`,
        powershell: `netsh wlan show interfaces`,
        applescript: `do shell script "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I"`,
      }, "Wi-Fi status incoming.");

    case "/bluetooth":
      return build(os, "Bluetooth", "Opens Bluetooth settings.", {
        bash: `blueman-manager & disown`,
        powershell: `Start-Process "ms-settings:bluetooth"`,
        applescript: `tell application "System Preferences" to reveal pane "com.apple.preferences.Bluetooth"`,
      }, "Opening Bluetooth.");

    case "/ip":
      return build(os, "IP Address", "Prints your local IP.", {
        bash: `hostname -I; curl -s ifconfig.me; echo`,
        powershell: `Get-NetIPAddress -AddressFamily IPv4 | Select IPAddress; (Invoke-WebRequest ifconfig.me).Content`,
        applescript: `do shell script "ipconfig getifaddr en0; curl -s ifconfig.me"`,
      }, "Fetching network address.");

    case "/ping":
      return build(os, `Ping ${arg || "google.com"}`, "Tests connectivity.", {
        bash: `ping -c 4 ${arg || "google.com"}`,
        powershell: `Test-Connection ${arg || "google.com"} -Count 4`,
        applescript: `do shell script "ping -c 4 ${arg || "google.com"}"`,
      }, `Pinging ${arg || "google.com"}.`);

    case "/whoami":
      return build(os, "Who Am I", "Prints your username.", {
        bash: `whoami; id`,
        powershell: `whoami; $env:USERNAME`,
        applescript: `do shell script "whoami"`,
      }, "Identifying user.");

    case "/date":
      return build(os, "Date & Time", "Prints current date/time.", {
        bash: `date`,
        powershell: `Get-Date`,
        applescript: `do shell script "date"`,
      }, "Current time on screen.");

    case "/volume": {
      const lvl = Math.max(0, Math.min(100, parseInt(arg) || 50));
      return build(os, `Volume → ${lvl}%`, "Sets system volume.", {
        bash: `pactl set-sink-volume @DEFAULT_SINK@ ${lvl}%`,
        powershell: `(New-Object -ComObject WScript.Shell).SendKeys([char]173); # mute toggle\n# For exact level install nircmd: nircmd setsysvolume ${Math.round(lvl * 655.35)}`,
        applescript: `set volume output volume ${lvl}`,
      }, `Volume set to ${lvl} percent.`);
    }

    case "/mute":
      return build(os, "Mute", "Mutes audio.", {
        bash: `pactl set-sink-mute @DEFAULT_SINK@ 1`,
        powershell: `(New-Object -ComObject WScript.Shell).SendKeys([char]173)`,
        applescript: `set volume with output muted`,
      }, "Muted.");

    case "/unmute":
      return build(os, "Unmute", "Unmutes audio.", {
        bash: `pactl set-sink-mute @DEFAULT_SINK@ 0`,
        powershell: `(New-Object -ComObject WScript.Shell).SendKeys([char]173)`,
        applescript: `set volume without output muted`,
      }, "Audio restored.");

    case "/brightness": {
      const lvl = Math.max(10, Math.min(100, parseInt(arg) || 70));
      return build(os, `Brightness → ${lvl}%`, "Sets display brightness.", {
        bash: `brightnessctl set ${lvl}%`,
        powershell: `(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${lvl})`,
        applescript: `do shell script "brightness ${(lvl / 100).toFixed(2)}"`,
      }, `Brightness ${lvl} percent.`);
    }

    case "/play":
      return build(os, "Play / Pause Media", "Toggles media playback.", {
        bash: `playerctl play-pause`,
        powershell: `(New-Object -ComObject WScript.Shell).SendKeys([char]179)`,
        applescript: `tell application "Music" to playpause`,
      }, "Toggling playback.");

    case "/pause":
      return build(os, "Pause Media", "Pauses media.", {
        bash: `playerctl pause`,
        powershell: `(New-Object -ComObject WScript.Shell).SendKeys([char]179)`,
        applescript: `tell application "Music" to pause`,
      }, "Paused.");

    case "/clipboard":
      return build(os, "Read Clipboard", "Prints clipboard contents.", {
        bash: `xclip -selection clipboard -o || wl-paste`,
        powershell: `Get-Clipboard`,
        applescript: `do shell script "pbpaste"`,
      }, "Reading clipboard.");

    case "/processes":
      return build(os, "List Processes", "Lists running processes.", {
        bash: `ps aux --sort=-%mem | head -n 20`,
        powershell: `Get-Process | Sort-Object CPU -Descending | Select-Object -First 20`,
        applescript: `do shell script "ps aux | sort -nrk 3 | head -n 20"`,
      }, "Listing processes.");

    case "/kill":
      return build(os, `Kill ${arg || "<process>"}`, "Terminates a process by name.", {
        bash: `pkill -f "${arg || "process"}"`,
        powershell: `Stop-Process -Name "${arg || "process"}" -Force`,
        applescript: `do shell script "pkill -f '${arg || "process"}'"`,
      }, `Terminating ${arg || "process"}.`);

    case "/uptime":
      return build(os, "Uptime", "Shows system uptime.", {
        bash: `uptime -p`,
        powershell: `(Get-CimInstance Win32_OperatingSystem).LastBootUpTime`,
        applescript: `do shell script "uptime"`,
      }, "Reporting uptime.");

    case "/disk":
      return build(os, "Disk Usage", "Shows disk space.", {
        bash: `df -h`,
        powershell: `Get-PSDrive -PSProvider FileSystem`,
        applescript: `do shell script "df -h"`,
      }, "Disk status.");

    case "/battery":
      return build(os, "Battery", "Shows battery percentage.", {
        bash: `upower -i $(upower -e | grep BAT) | grep -E "state|percentage"`,
        powershell: `(Get-WmiObject Win32_Battery).EstimatedChargeRemaining`,
        applescript: `do shell script "pmset -g batt"`,
      }, "Battery report.");

    default:
      return build(os, "Unknown command", `No handler for ${cmd}. Try /terminal, /chrome, /open <url>, /restart, /shutdown, /volume <0-100>.`, {
        bash: `echo "Unknown command: ${cmd}"`,
        powershell: `Write-Host "Unknown command: ${cmd}"`,
        applescript: `say "Unknown command"`,
      }, "I don't recognise that command, sir.");
  }
}

export const COMMAND_HELP: { cmd: string; desc: string }[] = [
  { cmd: "/terminal", desc: "Open terminal" },
  { cmd: "/chrome [url]", desc: "Open Chrome" },
  { cmd: "/firefox / /edge", desc: "Open browsers" },
  { cmd: "/open <url>", desc: "Open URL in default browser" },
  { cmd: "/search <query>", desc: "Google search" },
  { cmd: "/youtube [query]", desc: "YouTube" },
  { cmd: "/gmail / /maps / /news / /weather", desc: "Web shortcuts" },
  { cmd: "/settings", desc: "System settings" },
  { cmd: "/files", desc: "File manager" },
  { cmd: "/restart / /shutdown / /sleep / /lock / /logout", desc: "Power" },
  { cmd: "/screenshot", desc: "Take screenshot" },
  { cmd: "/notepad / /calc", desc: "Apps" },
  { cmd: "/wifi / /bluetooth / /ip / /ping <host>", desc: "Network" },
  { cmd: "/volume <0-100> / /mute / /unmute", desc: "Audio" },
  { cmd: "/brightness <0-100>", desc: "Display" },
  { cmd: "/play / /pause", desc: "Media" },
  { cmd: "/clipboard / /processes / /kill <name>", desc: "System" },
  { cmd: "/whoami / /date / /uptime / /disk / /battery", desc: "Info" },
];
