import pptxgen from "https://esm.sh/pptxgenjs@3.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface SlidesBody {
  topic: string;
  model?: string;
  slideCount?: number;
}

interface SlidePlan {
  title: string;
  subtitle?: string;
  slides: { title: string; bullets: string[] }[];
}

async function generatePlan(topic: string, model: string, count: number): Promise<SlidePlan> {
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
          content: `You design presentations. Reply ONLY with strict JSON of shape: {"title":"...", "subtitle":"...", "slides":[{"title":"...", "bullets":["...", "..."]}]}. Generate exactly ${count} content slides (not counting the title slide). Each slide has 3-5 concise bullets (max ~12 words each). No markdown.`,
        },
        { role: "user", content: `Create a slide deck about: ${topic}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

function buildPptx(plan: SlidePlan): Promise<ArrayBuffer> {
  // deno-lint-ignore no-explicit-any
  const pres: any = new (pptxgen as any)();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.title = plan.title;

  const PRIMARY = "0E2A47";
  const ACCENT = "06B6D4";
  const LIGHT = "F5F7FA";

  // Title slide
  const t = pres.addSlide();
  t.background = { color: PRIMARY };
  t.addText(plan.title, {
    x: 0.6, y: 2.6, w: 12, h: 1.6,
    fontSize: 44, bold: true, color: "FFFFFF", fontFace: "Calibri",
  });
  if (plan.subtitle) {
    t.addText(plan.subtitle, {
      x: 0.6, y: 4.3, w: 12, h: 0.8,
      fontSize: 20, color: ACCENT, fontFace: "Calibri",
    });
  }
  t.addShape("rect", { x: 0.6, y: 4.0, w: 1.2, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } });

  // Content slides
  for (const s of plan.slides) {
    const slide = pres.addSlide();
    slide.background = { color: LIGHT };
    // Top bar
    slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: PRIMARY }, line: { color: PRIMARY } });
    slide.addShape("rect", { x: 0, y: 0.6, w: 13.33, h: 0.06, fill: { color: ACCENT }, line: { color: ACCENT } });

    slide.addText(s.title, {
      x: 0.6, y: 0.95, w: 12, h: 0.9,
      fontSize: 28, bold: true, color: PRIMARY, fontFace: "Calibri",
    });

    const bulletText = s.bullets.map((b) => ({ text: b, options: { bullet: { code: "25CF" }, color: "1F2937" } }));
    slide.addText(bulletText, {
      x: 0.8, y: 2.0, w: 11.7, h: 5.0,
      fontSize: 18, fontFace: "Calibri", paraSpaceAfter: 10,
    });
  }

  return pres.write({ outputType: "arraybuffer" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as SlidesBody;
    if (!body?.topic || typeof body.topic !== "string") {
      return new Response(JSON.stringify({ error: "topic required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const model = body.model ?? "google/gemini-2.5-flash";
    const count = Math.min(Math.max(body.slideCount ?? 6, 3), 12);
    const plan = await generatePlan(body.topic, model, count);
    const buffer = await buildPptx(plan);
    const bytes = new Uint8Array(buffer);
    // base64 in chunks (avoid stack overflow on big buffers)
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);

    return new Response(
      JSON.stringify({
        title: plan.title,
        outline: plan,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename: `${plan.title.replace(/[^a-z0-9-_ ]/gi, "").slice(0, 60) || "presentation"}.pptx`,
        dataBase64: b64,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-slides error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
