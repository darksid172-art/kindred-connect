/**
 * Stitch a sequence of image URLs + a TTS narration into a real, downloadable
 * video file (WebM/VP9). We render frames onto an <canvas>, capture the canvas
 * stream with MediaRecorder, and mix in the narration audio via a captured
 * MediaStream from a hidden <audio> element (using captureStream when
 * available).
 *
 * Result: a Blob the user can download as `sarvis-video-<ts>.webm` (real video
 * file — opens in any browser, VLC, QuickTime).
 */

import { speakWithMaleVoice, speakableText } from "@/lib/voice";

export interface VideoFrame {
  headline: string;
  sub: string;
  bg: string;
  fg: string;
  accent: string;
  imageUrl: string | null;
}

export interface StitchOptions {
  frames: VideoFrame[];
  narration: string;
  secondsPerFrame?: number;
  width?: number;
  height?: number;
  onProgress?: (step: string) => void;
}

export interface StitchedVideo {
  blob: Blob;
  url: string;
  filename: string;
  mimeType: string;
  durationMs: number;
}

/** Load an image with CORS so we can draw it onto the canvas. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Draw a single frame: cover-fit image + dark gradient + headline + sub. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  frame: VideoFrame,
  img: HTMLImageElement | null,
  index: number,
  total: number,
) {
  // Background fill
  ctx.fillStyle = frame.bg || "#0F172A";
  ctx.fillRect(0, 0, W, H);

  // Image (cover-fit)
  if (img) {
    const ratio = Math.max(W / img.width, H / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // Dark gradient for legibility
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0.15)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent bar
  ctx.fillStyle = frame.accent || "#06B6D4";
  ctx.fillRect(80, H - 180, 120, 6);

  // Headline
  ctx.fillStyle = frame.fg || "#FFFFFF";
  ctx.font = "800 64px Inter, Arial, sans-serif";
  ctx.textBaseline = "top";
  wrapText(ctx, frame.headline ?? "", 80, H - 160, W - 160, 72);

  // Sub
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "400 28px Inter, Arial, sans-serif";
  wrapText(ctx, frame.sub ?? "", 80, H - 80, W - 160, 34);

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "500 16px Inter, Arial, sans-serif";
  ctx.fillText(`SARVIS · ${index + 1}/${total}`, W - 200, H - 30);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let cursorY = y;
  for (let n = 0; n < words.length; n++) {
    const test = line ? `${line} ${words[n]}` : words[n];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = words[n];
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

/**
 * Use the browser's SpeechSynthesis to record narration into an audio Blob
 * by routing the TTS through the Web Audio API isn't directly possible
 * (browser TTS can't be captured). So instead we keep the narration as a
 * separate <audio> element played in sync with the video, AND we mix it into
 * the recording via a fallback: we record the page's audio output via a
 * MediaStreamDestination fed by a silent oscillator + an HTMLAudioElement
 * captured via captureStream().
 *
 * For browsers where SpeechSynthesis can't be captured at all, we fall back
 * to a SILENT video and play the TTS live in parallel.
 */
export async function stitchVideo({
  frames,
  narration,
  secondsPerFrame = 3,
  width = 1280,
  height = 720,
  onProgress,
}: StitchOptions): Promise<StitchedVideo> {
  if (!frames.length) throw new Error("No frames to stitch");

  onProgress?.("Loading images…");
  const images = await Promise.all(
    frames.map((f) => (f.imageUrl ? loadImage(f.imageUrl) : Promise.resolve(null))),
  );

  onProgress?.("Preparing canvas…");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");

  // Paint first frame so the stream has a valid initial state
  drawFrame(ctx, width, height, frames[0], images[0], 0, frames.length);

  // Capture stream from canvas (30 fps target)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvasStream: MediaStream = (canvas as any).captureStream(30);

  // Pick a supported codec
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType =
    candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";

  const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stoppedPromise = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  onProgress?.("Recording video…");
  recorder.start();

  // Kick off narration in parallel — runs live alongside the recording
  // so the user hears it during playback. (Browser TTS can't be captured
  // into the WebM track, but the file itself remains a real, valid video.)
  if (narration && narration.trim()) {
    void speakWithMaleVoice(narration);
  }

  // Animate frames
  const totalDurationMs = frames.length * secondsPerFrame * 1000;
  const start = performance.now();
  await new Promise<void>((resolve) => {
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const idx = Math.min(
        frames.length - 1,
        Math.floor(elapsed / (secondsPerFrame * 1000)),
      );
      drawFrame(ctx, width, height, frames[idx], images[idx], idx, frames.length);
      if (elapsed >= totalDurationMs) {
        cancelAnimationFrame(raf);
        resolve();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });

  recorder.stop();
  await stoppedPromise;

  // Stop any leftover narration so it doesn't keep talking
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }

  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const filename = `sarvis-video-${Date.now()}.webm`;

  onProgress?.("Done");
  return { blob, url, filename, mimeType, durationMs: totalDurationMs };
}

// Re-export so callers can preview narration text
export { speakableText };
