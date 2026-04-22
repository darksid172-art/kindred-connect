import { getGoogleAccessToken, googleCors as corsHeaders } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";
    const token = await getGoogleAccessToken();
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    if (action === "list") {
      const days = Math.min(Math.max(parseInt(body.days) || 14, 1), 60);
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + days * 86400000).toISOString();
      const url =
        `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
        `?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
        `&singleEvents=true&orderBy=startTime&maxResults=20`;
      const r = await fetch(url, { headers: auth });
      if (!r.ok) throw new Error(`Calendar list ${r.status}: ${await r.text()}`);
      const data = await r.json();
      const events = (data.items ?? []).map((e: Record<string, unknown>) => ({
        id: e.id,
        summary: e.summary ?? "(no title)",
        description: e.description ?? "",
        location: e.location ?? "",
        start: (e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date,
        end: (e.end as Record<string, string>)?.dateTime ?? (e.end as Record<string, string>)?.date,
        htmlLink: e.htmlLink,
      }));
      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { summary, description, startISO, endISO, reminderMinutes } = body;
      if (!summary || !startISO || !endISO) {
        return new Response(JSON.stringify({ error: "summary, startISO, endISO required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const event: Record<string, unknown> = {
        summary,
        description: description ?? "",
        start: { dateTime: startISO, timeZone: tz },
        end: { dateTime: endISO, timeZone: tz },
      };
      if (typeof reminderMinutes === "number") {
        event.reminders = {
          useDefault: false,
          overrides: [{ method: "popup", minutes: Math.max(0, Math.min(reminderMinutes, 40320)) }],
        };
      }
      const r = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        { method: "POST", headers: auth, body: JSON.stringify(event) },
      );
      if (!r.ok) throw new Error(`Calendar create ${r.status}: ${await r.text()}`);
      const created = await r.json();
      return new Response(JSON.stringify({ event: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-calendar error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
