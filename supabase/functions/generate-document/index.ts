import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface DocBody {
  topic: string;
  format?: "pdf"; // future: docx
  model?: string;
}

async function generateOutline(topic: string, model: string): Promise<{
  title: string;
  sections: { heading: string; body: string }[];
}> {
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
            'You generate clean structured documents. Reply ONLY with strict JSON of shape: {"title":"...", "sections":[{"heading":"...", "body":"..."}]}. Body should be 2-4 short paragraphs separated by \\n\\n. 4-7 sections. No markdown.',
        },
        { role: "user", content: `Write a polished document about: ${topic}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const w = font.widthOfTextAtSize(test, fontSize);
      if (w > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines.push(""); // paragraph break
  }
  return lines;
}

async function buildPdf(doc: { title: string; sections: { heading: string; body: string }[] }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 60;
  const MAX_W = PAGE_W - MARGIN * 2;
  const fg = rgb(0.08, 0.08, 0.1);
  const accent = rgb(0.05, 0.55, 0.75);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  // Title
  const titleSize = 26;
  const titleLines = wrapText(doc.title, fontBold, titleSize, MAX_W);
  for (const line of titleLines) {
    if (!line) { y -= titleSize * 0.5; continue; }
    page.drawText(line, { x: MARGIN, y, size: titleSize, font: fontBold, color: fg });
    y -= titleSize * 1.25;
  }
  y -= 8;
  page.drawRectangle({ x: MARGIN, y, width: 60, height: 3, color: accent });
  y -= 30;

  for (const sec of doc.sections) {
    if (y < MARGIN + 60) newPage();
    // Heading
    const hSize = 16;
    page.drawText(sec.heading, { x: MARGIN, y, size: hSize, font: fontBold, color: fg });
    y -= hSize * 1.4;

    // Body
    const bSize = 11;
    const bodyLines = wrapText(sec.body, font, bSize, MAX_W);
    for (const line of bodyLines) {
      if (y < MARGIN + 20) newPage();
      if (line) {
        page.drawText(line, { x: MARGIN, y, size: bSize, font, color: fg });
      }
      y -= bSize * 1.5;
    }
    y -= 12;
  }

  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as DocBody;
    if (!body?.topic || typeof body.topic !== "string") {
      return new Response(JSON.stringify({ error: "topic required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const model = body.model ?? "google/gemini-2.5-flash";
    const outline = await generateOutline(body.topic, model);
    const pdfBytes = await buildPdf(outline);
    const b64 = btoa(String.fromCharCode(...pdfBytes));
    return new Response(
      JSON.stringify({
        title: outline.title,
        mimeType: "application/pdf",
        filename: `${outline.title.replace(/[^a-z0-9-_ ]/gi, "").slice(0, 60) || "document"}.pdf`,
        dataBase64: b64,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
