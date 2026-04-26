# SARVIS Auto-Launch on Startup

These scripts open SARVIS in your default browser whenever you log in.
Replace `SARVIS_URL` with your deployed URL (or `http://localhost:5173` for dev).

---

## Linux (systemd user service — works on GNOME, KDE, XFCE)

Create `~/.config/systemd/user/sarvis.service`:

```ini
[Unit]
Description=Open SARVIS on login
After=graphical-session.target

[Service]
Type=oneshot
ExecStart=/usr/bin/xdg-open https://YOUR-SARVIS-URL
RemainAfterExit=yes

[Install]
WantedBy=default.target
```

Then enable it:

```bash
systemctl --user daemon-reload
systemctl --user enable sarvis.service
```

---

## macOS (LaunchAgent)

Save as `~/Library/LaunchAgents/com.sarvis.autostart.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.sarvis.autostart</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>https://YOUR-SARVIS-URL</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.sarvis.autostart.plist
```

---

## Windows (Startup folder shortcut)

1. Press `Win + R`, type `shell:startup`, press Enter.
2. Right-click → New → Shortcut.
3. Location: `cmd /c start https://YOUR-SARVIS-URL`
4. Name it "SARVIS".

Or via PowerShell:

```powershell
$url = "https://YOUR-SARVIS-URL"
$path = "$([Environment]::GetFolderPath('Startup'))\SARVIS.url"
"[InternetShortcut]`nURL=$url" | Out-File -Encoding ASCII $path
```

---

## Also auto-start the SARVIS backend bridge

The bridge (port 3001) is required for system commands, file edits, and the local model.

**Linux** — add a second systemd user service `~/.config/systemd/user/sarvis-bridge.service`:

```ini
[Unit]
Description=SARVIS local bridge
After=network.target

[Service]
WorkingDirectory=%h/path/to/sarvis/backend
ExecStart=/usr/bin/npm run dev:backend
Restart=on-failure

[Install]
WantedBy=default.target
```

Then `systemctl --user enable --now sarvis-bridge.service`.

**macOS** — add `ProgramArguments` running `npm --prefix /path/to/sarvis/backend run dev:backend`.

**Windows** — use Task Scheduler → "At log on" → start `cmd /c "cd C:\path\to\sarvis\backend && npm run dev:backend"`.
