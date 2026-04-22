import { getGoogleAccessToken, googleCors as corsHeaders } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "channel";
    const token = await getGoogleAccessToken();
    const auth = { Authorization: `Bearer ${token}` };

    if (action === "channel") {
      const channelId = body.channelId || Deno.env.get("YOUTUBE_CHANNEL_ID");
      const url = channelId
        ? `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}`
        : `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`;
      const r = await fetch(url, { headers: auth });
      if (!r.ok) throw new Error(`YouTube channel ${r.status}: ${await r.text()}`);
      const data = await r.json();
      const ch = data.items?.[0];
      if (!ch) {
        return new Response(JSON.stringify({ error: "channel not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          id: ch.id,
          title: ch.snippet?.title,
          thumbnail: ch.snippet?.thumbnails?.default?.url,
          subscriberCount: parseInt(ch.statistics?.subscriberCount ?? "0"),
          subscriberHidden: ch.statistics?.hiddenSubscriberCount === true,
          viewCount: parseInt(ch.statistics?.viewCount ?? "0"),
          videoCount: parseInt(ch.statistics?.videoCount ?? "0"),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "search") {
      const q = String(body.query ?? "").trim();
      const max = Math.min(Math.max(parseInt(body.max) || 6, 1), 15);
      if (!q) {
        return new Response(JSON.stringify({ error: "query required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${max}&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: auth });
      if (!r.ok) throw new Error(`YouTube search ${r.status}: ${await r.text()}`);
      const data = await r.json();
      const videos = (data.items ?? []).map((it: Record<string, any>) => ({
        videoId: it.id?.videoId,
        title: it.snippet?.title,
        description: it.snippet?.description,
        channel: it.snippet?.channelTitle,
        publishedAt: it.snippet?.publishedAt,
        thumbnail: it.snippet?.thumbnails?.medium?.url,
      }));
      return new Response(JSON.stringify({ videos }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-youtube error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
