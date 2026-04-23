// Drive edge function — list, upload, download.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cached: { token: string; expiresAt: number } | null = null;
async function getGoogleAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 5 * 60 * 1000) return cached.token;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google OAuth secrets not configured");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) throw new Error(`Google token refresh ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[]);
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";
    const token = await getGoogleAccessToken();

    if (action === "list") {
      const q = typeof body.query === "string" && body.query.trim()
        ? `&q=${encodeURIComponent(`name contains '${body.query.replace(/'/g, "\\'")}' and trashed=false`)}`
        : "&q=trashed=false";
      const url =
        `https://www.googleapis.com/drive/v3/files?pageSize=25&orderBy=modifiedTime desc` +
        `&fields=files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)${q}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Drive list ${r.status}: ${await r.text()}`);
      const data = await r.json();
      return new Response(JSON.stringify({ files: data.files ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upload") {
      const { name, mimeType, dataBase64 } = body;
      if (!name || !mimeType || !dataBase64) {
        return new Response(JSON.stringify({ error: "name, mimeType, dataBase64 required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bin = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
      const boundary = "----lovable" + Math.random().toString(36).slice(2);
      const meta = JSON.stringify({ name });
      const enc = new TextEncoder();
      const pre = enc.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
          `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      );
      const post = enc.encode(`\r\n--${boundary}--`);
      const merged = new Uint8Array(pre.length + bin.length + post.length);
      merged.set(pre, 0);
      merged.set(bin, pre.length);
      merged.set(post, pre.length + bin.length);

      const r = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: merged,
        },
      );
      if (!r.ok) throw new Error(`Drive upload ${r.status}: ${await r.text()}`);
      const file = await r.json();
      return new Response(JSON.stringify({ file }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download") {
      const { fileId } = body;
      if (!fileId) {
        return new Response(JSON.stringify({ error: "fileId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const metaR = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!metaR.ok) throw new Error(`Drive meta ${metaR.status}`);
      const meta = await metaR.json();
      const r = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!r.ok) throw new Error(`Drive download ${r.status}: ${await r.text()}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      const dataBase64 = bytesToBase64(buf);
      return new Response(
        JSON.stringify({ name: meta.name, mimeType: meta.mimeType, dataBase64 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-drive error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
