// Client helpers for the SARVIS "computer control" + "self-edit" flows.
//
// Two pieces wire together:
//   1. Lovable Cloud edge functions (plan-command, plan-self-edit) do the AI
//      planning — they never touch your machine.
//   2. The local backend bridge (backend/server.mjs at http://localhost:3001)
//      actually runs the commands and writes the files. The user must have it
//      running on their own computer.
//
// Safety: the backend classifier blocks destructive patterns and flags risky
// commands as needing confirmation. The UI also surfaces the diff before any
// self-edit is written.

import { supabase } from "@/integrations/supabase/client";
import type { OS } from "@/lib/settings";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:3001";

export type CommandClassification = "safe" | "risky" | "blocked";

export interface PlannedCommand {
  cmd: string;
  why: string;
  needsConfirm: boolean;
}

export interface CommandPlan {
  explanation: string;
  commands: PlannedCommand[];
  refused: boolean;
}

export interface ExecResult {
  ok: boolean;
  code: number;
  classification: CommandClassification;
  cmd: string;
  os: string;
  output: string;
  error: string;
  needsConfirm?: boolean;
}

// ---- Intent detection ---------------------------------------------------

/**
 * Detects natural-language requests that should be turned into a shell plan.
 * Covers installs ("install chrome"), launches ("open vscode"), system control
 * ("shutdown", "lock the screen", "what's my battery"), info queries
 * ("disk usage", "list processes"), and explicit shell-y phrasing.
 *
 * Pure questions ("what is the time", "who is the president of kenya") are
 * intentionally NOT matched — those go to the chat model.
 */
export function parseComputerIntent(text: string): { isComputer: boolean; request: string } {
  const t = text.trim();
  if (!t) return { isComputer: false, request: "" };

  // Slash commands are handled elsewhere (systemCommands.ts).
  if (t.startsWith("/")) return { isComputer: false, request: "" };

  // Pure question form ("what / who / why / when / where / how / is / are ...")
  // unless it's clearly about THE machine (battery, disk, ip, processes, wifi).
  const looksLikePureQuestion =
    /^(what|who|why|when|where|how|is|are|does|do|did|can|could|would|should|tell me about|explain|define)\b/i.test(t)
    && !/\b(my|this|the)\s+(battery|disk|storage|cpu|ram|memory|ip|wifi|network|processes?|uptime|computer|laptop|pc|machine|system|screen|volume|brightness)\b/i.test(t)
    && !/\b(battery|disk\s*space|wifi\s*status|cpu\s*usage|ram\s*usage|ip\s*address|local\s*ip|process\s*list)\b/i.test(t);
  if (looksLikePureQuestion) return { isComputer: false, request: "" };

  const patterns: RegExp[] = [
    // package management
    /\b(install|uninstall|reinstall|remove|update|upgrade|purge)\s+\w/i,
    /\b(apt(-get)?|dnf|yum|pacman|brew|winget|choco|scoop|snap|flatpak|pip|pipx|npm|pnpm|yarn|bun|cargo|gem|go\s+install)\s+\w/i,
    // explicit shell / sudo
    /\bsudo\s+/i,
    /\b(in|on)\s+(my\s+)?(terminal|shell|bash|zsh|powershell|cmd)\b/i,
    /\b(run|execute|exec)\s+(the\s+)?(command|script|shell|cmd|`)/i,
    // app / file launching
    /\b(open|launch|start|fire\s+up|bring\s+up)\s+(?:my\s+|the\s+)?(chrome|firefox|edge|safari|terminal|finder|explorer|files|file\s+manager|notepad|gedit|vscode|vs\s*code|sublime|spotify|slack|discord|gimp|blender|code|calculator|calc|settings)\b/i,
    /\b(open|navigate to|go to)\s+(https?:\/\/|www\.)/i,
    // system control
    /\b(shut\s*down|shutdown|power\s*off|turn\s+off)\s+(my\s+)?(pc|computer|laptop|machine|system)?\b/i,
    /\b(restart|reboot)\s+(my\s+)?(pc|computer|laptop|machine|system)?\b/i,
    /\b(lock|sleep|suspend|hibernate|log\s*out|sign\s*out)\s+(my\s+)?(screen|pc|computer|laptop|machine|session|account)?\b/i,
    /\b(take|grab)\s+(a\s+)?(screenshot|screen\s*shot|screencap)\b/i,
    /\b(mute|unmute|set\s+volume|volume\s+to|increase\s+volume|decrease\s+volume|turn\s+(up|down)\s+the\s+volume|brightness\s+to)\b/i,
    /\b(connect|disconnect|toggle)\s+(wifi|wi-?fi|bluetooth)\b/i,
    /\b(kill|terminate|end)\s+(the\s+)?(process|task|app)\b/i,
    /\b(play|pause|resume|stop|skip)\s+(music|the\s+(song|track|video))\b/i,
    // info queries about my machine
    /\b(what'?s?|show|tell\s+me|check)\s+(my\s+|the\s+)?(battery|disk\s*(space|usage)?|cpu(\s*usage)?|ram|memory(\s*usage)?|wifi(\s*status)?|ip(\s*address)?|local\s*ip|public\s*ip|uptime|hostname|os\s*version|processes?|running\s*apps?)\b/i,
    /\b(list|show)\s+(running\s+)?(processes|tasks|apps|programs)\b/i,
    /\b(ping|traceroute|nslookup)\s+\S+/i,
    // file ops
    /\b(create|make|delete|remove|move|rename|copy)\s+(a\s+)?(file|folder|directory)\b/i,
    // permissions
    /\bchmod\s+|\bchown\s+/i,
    // services
    /\b(start|stop|restart|enable|disable)\s+(the\s+)?(service|daemon)\b/i,
  ];
  if (patterns.some((r) => r.test(t))) return { isComputer: true, request: t };
  return { isComputer: false, request: "" };
}

/** Detects "rename the settings button to ...", "edit your backend so ...", etc. */
export function parseSelfEditIntent(text: string): { isSelfEdit: boolean; request: string } {
  const t = text.trim();
  if (!t) return { isSelfEdit: false, request: "" };

  const patterns: RegExp[] = [
    /\b(edit|modify|change|update|rewrite)\s+(your(self)?|sarvis|the\s+(app|ui|interface|frontend|backend|sidebar|settings|button|theme|color|component))/i,
    /\brename\s+the\s+\w+\s+(button|label|tab|menu|component)/i,
    /\bchange\s+(your|the)\s+(ui|theme|color|background|layout|style)/i,
    /\bmake\s+yourself\s+/i,
  ];
  if (patterns.some((r) => r.test(t))) return { isSelfEdit: true, request: t };
  return { isSelfEdit: false, request: "" };
}

// ---- AI planning (edge functions) ---------------------------------------

export async function planCommand(
  request: string,
  os: OS,
  previousAttempt?: { cmd: string; code: number; output: string; error: string },
): Promise<{ plan?: CommandPlan; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("plan-command", {
      body: { request, os, previousAttempt },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    return { plan: data?.plan as CommandPlan };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "plan-command failed" };
  }
}

export async function planSelfEdit(
  request: string,
  currentPath?: string,
  currentContent?: string,
): Promise<{
  plan?: { path: string; newContent: string; explanation: string; refused: boolean; refuseReason?: string };
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke("plan-self-edit", {
      body: { request, currentPath, currentContent },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    return { plan: data?.plan };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "plan-self-edit failed" };
  }
}

// ---- Local backend (run + read/write files) -----------------------------

/** Runs one command on the user's machine. If risky and !confirmed → returns needsConfirm. */
export async function execCommand(cmd: string, confirmed = false): Promise<ExecResult | { error: string }> {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd, confirmed }),
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 409 && data?.needsConfirm) {
      return { ...(data as ExecResult), needsConfirm: true };
    }
    if (!resp.ok) {
      return { error: data?.error ?? `Backend ${resp.status}. Is the SARVIS bridge running on ${BACKEND_URL}?` };
    }
    return data as ExecResult;
  } catch (e) {
    return {
      error: `Cannot reach SARVIS bridge at ${BACKEND_URL}. Start it with: cd backend && npm run dev:backend`,
    };
  }
}

export async function readProjectFile(filePath: string): Promise<{ content?: string; error?: string }> {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/file/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { error: data?.error ?? `Read failed (${resp.status})` };
    return { content: data.content };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Read failed" };
  }
}

export async function writeProjectFile(
  filePath: string,
  content: string,
  confirmed = false,
): Promise<{ ok?: boolean; needsConfirm?: boolean; error?: string }> {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/file/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content, confirmed }),
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 409) return { needsConfirm: true };
    if (!resp.ok) return { error: data?.error ?? `Write failed (${resp.status})` };
    return { ok: true };
  } catch (e) {
    return {
      error: `Cannot reach SARVIS bridge at ${BACKEND_URL}. Start it with: cd backend && npm run dev:backend`,
    };
  }
}
