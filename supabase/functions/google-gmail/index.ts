import { getGoogleAccessToken, googleCors as corsHeaders } from "../_shared/google.ts";

interface MessageMeta {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";
    const token = await getGoogleAccessToken();
    const auth = { Authorization: `Bearer ${token}` };

    if (action === "list") {
      const max = Math.min(Math.max(parseInt(body.max) || 8, 1), 25);
      const q = typeof body.query === "string" ? `&q=${encodeURIComponent(body.query)}` : "";
      const listResp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}${q}`,
        { headers: auth },
      );
      if (!listResp.ok) throw new Error(`Gmail list ${listResp.status}: ${await listResp.text()}`);
      const list = await listResp.json();
      const ids: { id: string }[] = list.messages ?? [];

      const messages: MessageMeta[] = await Promise.all(
        ids.map(async ({ id }) => {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: auth },
          );
          const m = await r.json();
          const headers = (m.payload?.headers ?? []) as { name: string; value: string }[];
          const find = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
          return {
            id: m.id,
            from: find("From"),
            subject: find("Subject") || "(no subject)",
            snippet: m.snippet ?? "",
            date: find("Date"),
            unread: (m.labelIds ?? []).includes("UNREAD"),
          };
        }),
      );

      return new Response(JSON.stringify({ messages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-gmail error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
