import { useEffect, useRef, useState } from "react";
import { X, Copy, Volume2, Square, Check, Code as CodeIcon, Download, FileText, Presentation, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SlidePreview, type SlideOutline, type SlideTheme } from "@/components/SlidePreview";

export type CanvasKind = "code" | "pdf" | "pptx" | "video";

export interface CanvasContent {
  kind: CanvasKind;
  title?: string;
  // code:
  code?: string;
  language?: string;
  // file (pdf/pptx/video-svg): base64 + mime + filename
  dataBase64?: string;
  mimeType?: string;
  filename?: string;
  // optional preview text (used for TTS for slides/docs)
  speakText?: string;
  // optional audio (for videos)
  audioBase64?: string;
  // slides preview data
  outline?: SlideOutline;
  theme?: SlideTheme;
}

interface CodeCanvasProps {
  open: boolean;
  content: CanvasContent | null;
  onClose: () => void;
}

const ICONS: Record<CanvasKind, typeof CodeIcon> = {
  code: CodeIcon,
  pdf: FileText,
  pptx: Presentation,
  video: Film,
};

function b64ToBlobUrl(b64: string, mime: string): string {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export const CodeCanvas = ({ open, content, onClose }: CodeCanvasProps) => {
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Build blob URL for file content
  useEffect(() => {
    if (content?.dataBase64 && content?.mimeType) {
      const url = b64ToBlobUrl(content.dataBase64, content.mimeType);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setBlobUrl(null);
  }, [content]);

  // Build audio blob URL if audio is available
  useEffect(() => {
    if (content?.audioBase64) {
      try {
        const url = b64ToBlobUrl(content.audioBase64, "audio/mpeg");
        setAudioBlobUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.warn("Failed to create audio blob URL:", e);
        setAudioBlobUrl(null);
      }
    } else {
      setAudioBlobUrl(null);
    }
  }, [content?.audioBase64]);

  useEffect(() => {
    return () => {
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
      setSpeaking(false);
    }
  }, [open]);

  if (!open || !content) return null;

  const Icon = ICONS[content.kind] ?? CodeIcon;
  const speakSource = content.speakText ?? content.code ?? "";

  const handleSpeak = () => {
    if (!window.speechSynthesis) {
      toast.error("Speech synthesis not supported in this browser");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!speakSource.trim()) {
      toast.error("Nothing to read aloud");
      return;
    }
    // Pronounce SARVIS as "service" without altering displayed text
    const spoken = speakSource.replace(/\bSARVIS\b/gi, "service");
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    utteranceRef.current = utter;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content.code ?? content.speakText ?? "");
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    if (!blobUrl || !content.filename) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = content.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-card shadow-2xl",
        "sm:w-[480px] md:w-[540px] lg:w-[640px] xl:w-[720px]",
        "animate-in slide-in-from-right duration-200",
      )}
      aria-label="Canvas"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {content.title ?? "Canvas"}
            </p>
            {(content.language || content.filename) && (
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
                {content.language ?? content.filename}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(content.kind === "code" || speakSource) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSpeak}
              className="h-8 gap-1.5"
              aria-label={speaking ? "Stop speaking" : "Speak"}
            >
              {speaking ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline text-xs">{speaking ? "Stop" : "Speak"}</span>
            </Button>
          )}
          {content.kind === "code" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                const cmd = content.code ?? "";
                if (!cmd.trim()) return;
                try {
                  const runResp = await fetch('/api/run-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cmd }),
                  });
                  const json = await runResp.json();
                  const output = json.output || json.error || '';
                  // send output back to AI for analysis
                  await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: `Command output:\n${output}` }),
                  });
                  alert('Command executed. Output sent to AI for analysis.');
                } catch (e) {
                  console.error(e);
                  alert('Failed to run command');
                }
              }}
              className="h-8 gap-1.5"
              aria-label="Run command"
            >
              <CodeIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Run</span>
            </Button>
          )}
          {content.kind === "code" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 gap-1.5"
              aria-label="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline text-xs">{copied ? "Copied" : "Copy"}</span>
            </Button>
          )}
          {blobUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 gap-1.5"
              aria-label="Download file"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Download</span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Close canvas"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {content.kind === "code" && (
        <ScrollArea className="flex-1 scrollbar-thin">
          <pre className="m-0 whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-foreground">
            <code>{content.code}</code>
          </pre>
        </ScrollArea>
      )}

      {content.kind === "pdf" && blobUrl && (
        <div className="flex-1 bg-muted/30">
          <iframe src={blobUrl} title={content.title ?? "PDF"} className="h-full w-full border-0" />
        </div>
      )}

      {content.kind === "pptx" && content.outline && (
        <div className="flex-1 min-h-0">
          <SlidePreview
            outline={content.outline}
            theme={
              content.theme ?? {
                id: "midnight",
                name: "Midnight Executive",
                bg: "F5F7FA",
                titleBg: "1E2761",
                primary: "1E2761",
                accent: "06B6D4",
                body: "1F2937",
                titleFg: "FFFFFF",
                fontHead: "Calibri",
                fontBody: "Calibri",
                layout: "topbar",
              }
            }
          />
        </div>
      )}

      {content.kind === "pptx" && !content.outline && (
        <ScrollArea className="flex-1 scrollbar-thin">
          <div className="p-6 space-y-4">
            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-sm font-medium text-foreground">{content.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PowerPoint deck ready. Click <strong>Download</strong> to save the .pptx file.
              </p>
            </div>
          </div>
        </ScrollArea>
      )}

      {content.kind === "video" && blobUrl && (
        <div className="flex-1 flex flex-col items-center justify-center bg-black">
          <img src={blobUrl} alt={content.title ?? "video"} className="max-h-full max-w-full" />
          {audioBlobUrl && (
            <div className="w-full bg-secondary/80 border-t border-border p-4">
              <div className="max-w-full mx-auto">
                <p className="text-xs text-muted-foreground mb-2">🎤 Narration</p>
                <audio
                  ref={audioRef}
                  src={audioBlobUrl}
                  controls
                  className="w-full"
                  autoPlay={false}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
