import { supabase } from "@/integrations/supabase/client";
import type { SlideOutline, SlideTheme } from "@/components/SlidePreview";

export interface GenFileResult {
  title?: string;
  filename?: string;
  mimeType?: string;
  dataBase64?: string;
  speakText?: string;
  audioBase64?: string;
  outline?: SlideOutline;
  theme?: SlideTheme;
  error?: string;
}

export async function generateDocument(topic: string, model?: string): Promise<GenFileResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-document", {
      body: { topic, model },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    return data as GenFileResult;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Document generation failed" };
  }
}

export async function generateSlides(topic: string, model?: string): Promise<GenFileResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-slides", {
      body: { topic, model },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    // Build a speakable summary from the outline
    let speakText = "";
    if (data?.outline) {
      speakText = `${data.outline.title}. `;
      if (data.outline.subtitle) speakText += `${data.outline.subtitle}. `;
      for (const s of data.outline.slides ?? []) {
        speakText += `${s.title}. ${(s.bullets ?? []).join(". ")}. `;
      }
    }
    return { ...data, speakText } as GenFileResult;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Slide generation failed" };
  }
}

export async function generateVideo(prompt: string, model?: string): Promise<GenFileResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-video", {
      body: { prompt, model },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    let speakText = "";
    if (Array.isArray(data?.frames)) {
      speakText = data.frames
        .map((f: { headline?: string; sub?: string }) => `${f.headline ?? ""}. ${f.sub ?? ""}`)
        .join(" ");
    }
    
    // Generate Jarvis-like audio narration for the video
    let audioBase64 = "";
    if (speakText) {
      try {
        const ttsResult = await generateTTS(speakText);
        audioBase64 = ttsResult.audioBase64 || "";
      } catch (e) {
        console.warn("TTS generation failed, video will play without audio:", e);
      }
    }
    
    return { ...data, speakText, audioBase64 } as GenFileResult;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Video generation failed" };
  }
}

export async function generateTTS(text: string): Promise<{ audioBase64: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-tts", {
      body: { text },
    });
    if (error) return { audioBase64: "" };
    return { audioBase64: data?.audioBase64 || "" };
  } catch (e) {
    console.warn("TTS API call failed:", e);
    return { audioBase64: "" };
  }
}
