// Augments any SARVIS system prompt with the user's actual local time, date,
// timezone, locale and country so the model never invents a wrong "current time".

import { loadSettings } from "@/lib/settings";

const COUNTRY_NAMES: Record<string, string> = {
  ke: "Kenya", us: "United States", gb: "United Kingdom", in: "India",
  ng: "Nigeria", za: "South Africa", au: "Australia", ca: "Canada",
  de: "Germany", fr: "France", jp: "Japan", cn: "China", br: "Brazil",
  ug: "Uganda", tz: "Tanzania", rw: "Rwanda", et: "Ethiopia", gh: "Ghana",
};

export function getLocalContext() {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const locale = (typeof navigator !== "undefined" && navigator.language) || "en-US";
  const settings = loadSettings();
  const cc = (settings.userProfile?.country || "").toLowerCase();
  const country = cc ? (COUNTRY_NAMES[cc] || cc.toUpperCase()) : undefined;
  const userName = settings.userProfile?.name || undefined;

  const dateStr = now.toLocaleDateString(locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
  });
  const timeStr = now.toLocaleTimeString(locale, {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  });
  const isoLocal = now.toISOString();

  return { now, tz, locale, country, userName, dateStr, timeStr, isoLocal };
}

/**
 * Prepends a "live context" block to a system prompt so the LLM answers
 * date/time/region questions correctly using the user's actual environment
 * instead of hallucinating UTC or stale values.
 */
export function withLocalContext(systemPrompt: string): string {
  const c = getLocalContext();
  const lines = [
    "LIVE USER CONTEXT (authoritative — use these instead of guessing):",
    `- Current local date: ${c.dateStr}`,
    `- Current local time: ${c.timeStr} (${c.tz})`,
    `- ISO timestamp: ${c.isoLocal}`,
    `- Locale: ${c.locale}`,
    c.country ? `- User country: ${c.country}` : "",
    c.userName ? `- User name: ${c.userName} (greet by name when natural)` : "",
    "When the user asks about time, date, day, weather region, or 'where I am', use the values above. Never reply with UTC unless explicitly asked.",
  ].filter(Boolean).join("\n");
  return `${lines}\n\n${systemPrompt}`;
}
