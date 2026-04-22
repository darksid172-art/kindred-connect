/**
 * Generate-video: returns the raw building blocks the frontend needs to
 * stitch a REAL video file (images + narration audio) — instead of an
 * animated SVG.
 *
 * Flow:
 *  1. Use Lovable AI Gateway to plan a 5-frame storyboard (headline + sub
 *     for each frame, plus a tightly focused image search query per frame).
 *  2. Fetch a high-quality image per frame from Wikipedia's REST search API
 *     (no API key needed, returns Commons / public-domain images).
 *  3. Return everything as JSON. The frontend renders frames onto a Canvas,
 *     records via MediaRecorder, mixes the narration audio, and produces a
 *     downloadable .webm video file.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface VideoBody {
  prompt: string;
  model?: string;
}

interface PlannedFrame {
  headline: string;
  sub: string;
  imageQuery: string;
  bg: string; // fallback background hex
  fg: string;
  accent: string;
}

interface RenderFrame extends PlannedFrame {
  imageUrl: string | null;
}

async function planStoryboard(prompt: string, model: string): Promise<PlannedFrame[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            'You design 5-frame educational video storyboards. Reply ONLY with strict JSON: {"frames":[{"headline":"...","sub":"...","imageQuery":"...","bg":"#hex","fg":"#hex","accent":"#hex"}]}. Exactly 5 frames. headline max 50 chars, sub max 90 chars. imageQuery is a SHORT (2-4 words) Wikipedia-friendly noun phrase that visually represents the frame (e.g. "Eiffel Tower", "Solar panel", "Mount Fuji"). Pick vivid, on-topic colors as fallback if no image is found.',
        },
        { role: "user", content: `Storyboard for: ${prompt}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const frames: PlannedFrame[] = parsed.frames ?? [];
  if (frames.length < 1) throw new Error("Model returned no frames");
  return frames.slice(0, 5);
}

/**
 * Find a representative image for a query via Wikipedia's REST API.
 * Tries page summary first (returns a hero image) — falls back to null.
 */
async function findImageForQuery(query: string): Promise<string | null> {
  const cleaned = query.trim().slice(0, 120);
  if (!cleaned) return null;
  try {
    // Step 1: search for matching page title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleaned,
    )}&format=json&origin=*&srlimit=1`;
    const sRes = await fetch(searchUrl);
    if (!sRes.ok) return null;
    const sJson = await sRes.json();
    const title: string | undefined = sJson?.query?.search?.[0]?.title;
    if (!title) return null;

    // Step 2: pull page summary which includes a thumbnail / originalimage
    const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title,
    )}`;
    const pRes = await fetch(sumUrl, {
      headers: { "User-Agent": "SARVIS/1.0 (lovable.app)" },
    });
    if (!pRes.ok) return null;
    const pJson = await pRes.json();
    const url: string | undefined =
      pJson?.originalimage?.source ?? pJson?.thumbnail?.source;
    return url ?? null;
  } catch (e) {
    console.warn("image lookup failed for", query, e);
    return null;
  }
}

async function generateNarration(prompt: string, model: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Write a short, conversational narration script (3-5 sentences, ~50-70 words) for a 10-second educational video. Plain text only — no markdown, no bullets, no stage directions.",
        },
        { role: "user", content: `Topic: ${prompt}` },
      ],
    }),
  });
  if (!res.ok) return "";
  const json = await res.json();
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as VideoBody;
    if (!body?.prompt || typeof body.prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const model = body.model ?? "google/gemini-2.5-flash";

    // 1. Plan storyboard
    const planned = await planStoryboard(body.prompt, model);

    // 2. Resolve images in parallel
    const withImages: RenderFrame[] = await Promise.all(
      planned.map(async (f) => ({
        ...f,
        imageUrl: await findImageForQuery(f.imageQuery || f.headline),
      })),
    );

    // 3. Narration
    const narration = await generateNarration(body.prompt, model);

    return new Response(
      JSON.stringify({
        kind: "video",
        title: `Video · ${body.prompt}`.slice(0, 80),
        frames: withImages,
        narration,
        secondsPerFrame: 3,
        note:
          "Frontend will stitch these frames + narration into a real .webm video using Canvas + MediaRecorder.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
