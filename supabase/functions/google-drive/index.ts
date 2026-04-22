import { getGoogleAccessToken, googleCors as corsHeaders } from "../_shared/google.ts";

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
      // Expect: { name, mimeType, dataBase64 }
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
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const dataBase64 = btoa(bin);
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
