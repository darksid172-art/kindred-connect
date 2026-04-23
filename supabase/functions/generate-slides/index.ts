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
  themeId?: string;
}

interface SlidePlan {
  title: string;
  subtitle?: string;
  slides: { title: string; bullets: string[] }[];
}

// ---------- Creative themes ----------
interface Theme {
  id: string;
  name: string;
  bg: string;        // background of content slides
  titleBg: string;   // background of the title slide
  primary: string;   // primary text on content slides (titles, accent bars)
  accent: string;    // accent color
  body: string;      // body text color
  titleFg: string;   // title slide text
  fontHead: string;
  fontBody: string;
  layout: "topbar" | "sidebar" | "card" | "minimal" | "gradient";
}

// Five canonical templates the user can pick from in the UI.
const THEMES: Theme[] = [
  {
    id: "corporate",
    name: "Corporate / Business",
    bg: "F5F7FA", titleBg: "1E2761",
    primary: "1E2761", accent: "06B6D4", body: "1F2937", titleFg: "FFFFFF",
    fontHead: "Calibri", fontBody: "Calibri", layout: "topbar",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    bg: "F2F2F2", titleBg: "212121",
    primary: "212121", accent: "F96167", body: "212121", titleFg: "F2F2F2",
    fontHead: "Palatino", fontBody: "Calibri", layout: "minimal",
  },
  {
    id: "creative",
    name: "Creative / Modern",
    bg: "FFFFFF", titleBg: "F96167",
    primary: "2F3C7E", accent: "F96167", body: "2F3C7E", titleFg: "FFFFFF",
    fontHead: "Arial Black", fontBody: "Arial", layout: "card",
  },
  {
    id: "pitch",
    name: "Pitch Deck",
    bg: "FCF6F5", titleBg: "990011",
    primary: "990011", accent: "2F3C7E", body: "1F1F1F", titleFg: "FCF6F5",
    fontHead: "Impact", fontBody: "Arial", layout: "gradient",
  },
  {
    id: "infographic",
    name: "Data / Infographic",
    bg: "F4FFFD", titleBg: "028090",
    primary: "028090", accent: "02C39A", body: "1F2937", titleFg: "FFFFFF",
    fontHead: "Trebuchet MS", fontBody: "Calibri", layout: "sidebar",
  },
];

function pickTheme(themeId?: string): Theme {
  if (themeId) {
    const found = THEMES.find((t) => t.id === themeId);
    if (found) return found;
  }
  return THEMES[Math.floor(Math.random() * THEMES.length)];
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

function buildPptx(plan: SlidePlan, theme: Theme): Promise<ArrayBuffer> {
  // deno-lint-ignore no-explicit-any
  const pres: any = new (pptxgen as any)();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.title = plan.title;

  // ---- Title slide ----
  const t = pres.addSlide();
  t.background = { color: theme.titleBg };

  if (theme.layout === "gradient") {
    // Decorative accent block on the right
    t.addShape("rect", { x: 9.5, y: 0, w: 3.83, h: 7.5, fill: { color: theme.accent }, line: { color: theme.accent } });
  } else if (theme.layout === "sidebar") {
    t.addShape("rect", { x: 0, y: 0, w: 0.4, h: 7.5, fill: { color: theme.accent }, line: { color: theme.accent } });
  }

  t.addText(plan.title, {
    x: 0.8, y: 2.6, w: 11.5, h: 1.8,
    fontSize: 48, bold: true, color: theme.titleFg, fontFace: theme.fontHead,
  });
  if (plan.subtitle) {
    t.addText(plan.subtitle, {
      x: 0.8, y: 4.5, w: 11.5, h: 0.9,
      fontSize: 22, color: theme.accent, fontFace: theme.fontBody,
    });
  }

  // ---- Content slides ----
  for (const s of plan.slides) {
    const slide = pres.addSlide();
    slide.background = { color: theme.bg };

    // Layout-specific decorations
    if (theme.layout === "topbar") {
      slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: theme.primary }, line: { color: theme.primary } });
      slide.addShape("rect", { x: 0, y: 0.6, w: 13.33, h: 0.06, fill: { color: theme.accent }, line: { color: theme.accent } });
    } else if (theme.layout === "sidebar") {
      slide.addShape("rect", { x: 0, y: 0, w: 0.5, h: 7.5, fill: { color: theme.primary }, line: { color: theme.primary } });
    } else if (theme.layout === "card") {
      slide.addShape("rect", { x: 0.5, y: 0.5, w: 12.33, h: 6.5, fill: { color: "FFFFFF" }, line: { color: theme.accent, width: 1 } });
    } else if (theme.layout === "gradient") {
      slide.addShape("rect", { x: 0, y: 6.9, w: 13.33, h: 0.6, fill: { color: theme.primary }, line: { color: theme.primary } });
    }
    // minimal: no decoration

    const titleX = theme.layout === "sidebar" ? 0.95 : (theme.layout === "card" ? 0.95 : 0.6);
    const titleY = theme.layout === "topbar" ? 0.95 : (theme.layout === "card" ? 0.95 : 0.7);

    slide.addText(s.title, {
      x: titleX, y: titleY, w: 11.5, h: 0.9,
      fontSize: 30, bold: true, color: theme.primary, fontFace: theme.fontHead,
    });

    const bulletText = s.bullets.map((b) => ({
      text: b,
      options: { bullet: { code: "25CF" }, color: theme.body },
    }));
    slide.addText(bulletText, {
      x: titleX + 0.2, y: titleY + 1.1, w: 11.3, h: 5.0,
      fontSize: 18, fontFace: theme.fontBody, paraSpaceAfter: 12,
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
    const theme = pickTheme(body.themeId);
    const plan = await generatePlan(body.topic, model, count);
    const buffer = await buildPptx(plan, theme);
    const bytes = new Uint8Array(buffer);
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
        theme: {
          id: theme.id,
          name: theme.name,
          bg: theme.bg,
          titleBg: theme.titleBg,
          primary: theme.primary,
          accent: theme.accent,
          body: theme.body,
          titleFg: theme.titleFg,
          fontHead: theme.fontHead,
          fontBody: theme.fontBody,
          layout: theme.layout,
        },
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
