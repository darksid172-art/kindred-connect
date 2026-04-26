# SARVIS Backend Server

This is the backend server for executing SARVIS system commands on Linux, Windows, and macOS.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the backend server:
```bash
npm run dev:backend
```

The server will run on `http://localhost:3001`

## API Endpoints

### POST /api/sarvis
Execute a SARVIS slash command (e.g. `/terminal`, `/chrome`).

### POST /api/exec  ← natural-language command runner
Run an arbitrary shell command for the AI assistant.

**Request body:** `{ "cmd": "sudo apt install -y htop", "confirmed": false }`

**Response codes:**
- `200` — `{ ok, code, classification, output, error, os }`
- `409` — `{ needsConfirm: true, classification: "risky", cmd }` — UI must re-send with `confirmed: true`
- `403` — `{ classification: "blocked", error }` — destructive pattern, never run

Classification:
- `safe` — runs immediately
- `risky` — requires `confirmed: true` (sudo, package install, rm, systemctl, …)
- `blocked` — refused (rm -rf /, mkfs, fork bomb, dd to /dev/sd*)

### POST /api/file/read · /api/file/write · /api/file/list
Read/write files inside the project root for the "edit your own code" feature.
Writes require `confirmed: true` and create a timestamped backup in `.sarvis-backups/`.


## Supported Commands

All commands listed in the SARVIS System Commands are supported:
- System: `/terminal`, `/settings`, `/files`, `/restart`, `/shutdown`, `/sleep`, `/lock`, `/logout`
- Browsers: `/chrome`, `/firefox`, `/edge`, `/open`, `/search`, `/youtube`, `/gmail`, `/maps`, `/news`, `/weather`
- Apps: `/notepad`, `/calc`
- Network: `/wifi`, `/bluetooth`, `/ip`, `/ping`
- Audio/Display: `/volume`, `/mute`, `/unmute`, `/brightness`
- System Info: `/whoami`, `/date`, `/uptime`, `/disk`, `/battery`
- And more...

## Running Both Frontend and Backend

Run these in separate terminals:

**Terminal 1 (Frontend):**
```bash
npm run dev
```

**Terminal 2 (Backend):**
```bash
npm run dev:backend
```

The frontend will connect to the backend at `http://localhost:3001` (as specified in `.env`)

## Files

- `server.mjs` - Main backend server (Node.js ES Module, runs directly with `node`)
- `server.ts` - Alternative TypeScript version (for reference, requires TypeScript compilation)
