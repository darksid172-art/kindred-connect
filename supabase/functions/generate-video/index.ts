const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

/**
 * Lovable AI Gateway does not (yet) expose a hosted text-to-video model.
 * We fall back to generating an animated SVG "story" (5 frames, 1s each)
 * encoded as an animated SMIL/SVG that can play in any browser. This gives
 * the user something tangible while keeping zero cost / zero extra deps.
 *
 * The AI is asked to design 5 frames (background color + headline + sub).
 * Each frame fades in/out using SMIL. The result is wrapped in an .svg file
 * which most modern browsers play natively as an animated graphic.
 */

interface VideoBody {
  prompt: string;
  model?: string;
}

interface Frame {
  bg: string;
  fg: string;
  accent: string;
  headline: string;
  sub?: string;
}

async function generateStoryboard(prompt: string, model: string): Promise<Frame[]> {
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
            'You design 5-frame animated story videos. Reply ONLY with strict JSON: {"frames":[{"bg":"#hex","fg":"#hex","accent":"#hex","headline":"...", "sub":"..."}]}. Exactly 5 frames. Headline max 40 chars, sub max 70 chars. Choose vivid, on-topic colors.',
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
  const frames: Frame[] = parsed.frames ?? [];
  if (frames.length < 1) throw new Error("Model returned no frames");
  return frames.slice(0, 5);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildAnimatedSvg(frames: Frame[]): string {
  const W = 1280;
  const H = 720;
  const FRAME_DUR = 2; // seconds per frame
  const TOTAL = frames.length * FRAME_DUR;

  const groups = frames
    .map((f, i) => {
      const begin = i * FRAME_DUR;
      const headline = escapeXml(f.headline ?? "");
      const sub = escapeXml(f.sub ?? "");
      return `
        <g opacity="0">
          <rect width="${W}" height="${H}" fill="${f.bg}"/>
          <rect x="80" y="${H - 90}" width="120" height="6" fill="${f.accent}"/>
          <text x="80" y="${H / 2 - 20}" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="800" fill="${f.fg}">${headline}</text>
          <text x="80" y="${H / 2 + 40}" font-family="Inter, Arial, sans-serif" font-size="28" fill="${f.accent}">${sub}</text>
          <text x="${W - 220}" y="${H - 60}" font-family="Inter, Arial, sans-serif" font-size="16" fill="${f.fg}" opacity="0.5">SARVIS · ${i + 1}/${frames.length}</text>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1"
            dur="${FRAME_DUR}s" begin="${begin}s" fill="freeze" repeatCount="indefinite" />
        </g>`;
    })
    .join("\n");

  // Loop the whole thing by using indefinite repetition on each frame group.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${frames[0].bg}"/>
  ${groups}
  <!-- total ${TOTAL}s loop -->
</svg>`;
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
    const frames = await generateStoryboard(body.prompt, model);
    const svg = buildAnimatedSvg(frames);
    const b64 = btoa(unescape(encodeURIComponent(svg)));
    return new Response(
      JSON.stringify({
        mimeType: "image/svg+xml",
        filename: `sarvis-video-${Date.now()}.svg`,
        dataBase64: b64,
        frames,
        note: "Animated SVG story (loops). Plays inline in any browser.",
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
