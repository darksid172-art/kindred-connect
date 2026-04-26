import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendChat, type Message } from "@/lib/sarvis";
import type { AppSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import sarvisLogo from "@/assets/sarvis-logo.png";
import { speakWithMaleVoice } from "@/lib/voice";

interface CallOverlayProps {
  open: boolean;
  onHangup: () => void;
  history: Message[];
  settings: AppSettings;
  onTurnComplete: (userText: string, aiText: string) => void;
}

type CallState = "idle" | "listening" | "thinking" | "speaking";

// SpeechRecognition shim across browsers
function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export const CallOverlay = ({ open, onHangup, history, settings, onTurnComplete }: CallOverlayProps) => {
  const [muted, setMuted] = useState(false);
  const [state, setState] = useState<CallState>("idle");
  const [partial, setPartial] = useState("");
  const [lastUser, setLastUser] = useState("");
  const [lastAi, setLastAi] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioOn, setAudioOn] = useState(true);

  const recognitionRef = useRef<any>(null);
  const liveHistoryRef = useRef<Message[]>([]);
  const mutedRef = useRef(false);
  const audioOnRef = useRef(true);
  const stoppingRef = useRef(false);
  const finalTextRef = useRef("");

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { audioOnRef.current = audioOn; }, [audioOn]);

  const supported = !!getSpeechRecognition() && typeof window !== "undefined" && !!window.speechSynthesis;

  // Whenever the call opens, initialize history snapshot
  useEffect(() => {
    if (open) {
      liveHistoryRef.current = [...history];
      setError(null);
      setLastUser("");
      setLastAi("");
      setPartial("");
      if (supported) startListening();
    } else {
      cleanup();
    }
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cleanup = () => {
    stoppingRef.current = true;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    recognitionRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    setState("idle");
    setPartial("");
    finalTextRef.current = "";
  };

  const speak = (text: string): Promise<void> => {
    if (!audioOnRef.current) return Promise.resolve();
    // Shared helper: deep male voice, pronounces "SARVIS" as "service".
    return speakWithMaleVoice(text);
  };

  const startListening = () => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setError("Voice recognition isn't supported in this browser. Try Chrome.");
      return;
    }
    stoppingRef.current = false;
    finalTextRef.current = "";
    setPartial("");
    setState("listening");

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (final) finalTextRef.current += final;
      setPartial(finalTextRef.current + interim);
    };

    rec.onerror = (e: any) => {
      // Common: "no-speech" — just restart
      if (e.error === "no-speech" || e.error === "aborted") {
        return;
      }
      console.error("SpeechRecognition error", e);
      if (e.error === "not-allowed") {
        setError("Microphone permission denied. Allow mic access and reopen the call.");
      } else {
        setError(`Voice error: ${e.error}`);
      }
    };

    rec.onend = () => {
      const text = finalTextRef.current.trim();
      finalTextRef.current = "";
      setPartial("");

      if (stoppingRef.current) return;

      if (mutedRef.current || !text) {
        // Restart listening if still in call but nothing said / muted
        if (!stoppingRef.current && open) {
          try { rec.start(); } catch { /* will be replaced */ }
        }
        return;
      }

      handleUserTurn(text);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.error("rec start failed", e);
    }
  };

  const handleUserTurn = async (userText: string) => {
    setLastUser(userText);
    setState("thinking");

    const userMsg: Message = {
      id: `voice_u_${Date.now()}`,
      role: "user",
      content: userText,
      createdAt: Date.now(),
    };

    const messagesForApi = [...liveHistoryRef.current, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const { withLocalContext } = await import("@/lib/localContext");
    const baseVoicePrompt = settings.systemPrompt && settings.systemPrompt.trim().length > 0
      ? `${settings.systemPrompt}\n\nIMPORTANT: This reply will be spoken aloud. Keep it short and conversational. No markdown, no code blocks, no bullet lists.`
      : "You are SARVIS. This reply will be spoken aloud — keep it short and conversational, no markdown.";
    const result = await sendChat({
      messages: messagesForApi,
      model: settings.model,
      systemPrompt: withLocalContext(baseVoicePrompt),
    });

    if (result.error) {
      setError(result.error);
      setState("listening");
      // Restart listening
      if (!stoppingRef.current) startListening();
      return;
    }

    const reply = (result.reply || "Sorry, I didn't catch that.").trim();
    setLastAi(reply);

    const aiMsg: Message = {
      id: `voice_a_${Date.now()}`,
      role: "assistant",
      content: reply,
      createdAt: Date.now(),
    };

    liveHistoryRef.current = [...liveHistoryRef.current, userMsg, aiMsg];
    onTurnComplete(userText, reply);

    setState("speaking");
    await speak(reply);

    if (!stoppingRef.current) {
      setState("listening");
      startListening();
    }
  };

  const handleHangup = () => {
    cleanup();
    onHangup();
  };

  if (!open) return null;

  const statusLabel = {
    idle: "Connecting…",
    listening: muted ? "Muted" : "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking",
  }[state];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background/95 backdrop-blur-xl animate-in fade-in duration-200 py-12 px-6">
      {/* Top status */}
      <div className="text-center space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">SARVIS Voice Call</p>
        <p className="text-sm text-foreground/80">{statusLabel}</p>
      </div>

      {/* Center avatar */}
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="relative">
          {(state === "listening" && !muted) && (
            <>
              <span className="absolute inset-0 rounded-full bg-foreground/10 pulse-ring" />
              <span className="absolute inset-0 rounded-full bg-foreground/10 pulse-ring" style={{ animationDelay: "0.5s" }} />
            </>
          )}
          <div
            className={cn(
              "relative flex h-40 w-40 items-center justify-center rounded-full overflow-hidden border border-primary/50 bg-background transition-transform duration-300 glow-ring",
              state === "speaking" && "scale-110",
              state === "thinking" && "animate-pulse",
            )}
          >
            <img src={sarvisLogo} alt="SARVIS" className="h-full w-full object-cover" />
          </div>
        </div>

        <div className="min-h-[80px] max-w-md space-y-3">
          {lastUser && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground/70">You: </span>
              {lastUser}
            </p>
          )}
          {partial && state === "listening" && (
            <p className="text-sm text-foreground/60 italic">{partial}</p>
          )}
          {lastAi && state !== "listening" && (
            <p className="text-base text-foreground">{lastAi}</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!supported && (
            <p className="text-sm text-destructive">
              Voice features need a modern browser (Chrome recommended).
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-5">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setMuted((m) => !m)}
          className="h-14 w-14 rounded-full p-0"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          onClick={handleHangup}
          className="h-16 w-16 rounded-full p-0 shadow-lg"
          aria-label="Hang up"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            const next = !audioOn;
            setAudioOn(next);
            if (!next) window.speechSynthesis?.cancel();
          }}
          className="h-14 w-14 rounded-full p-0"
          aria-label={audioOn ? "Mute SARVIS" : "Unmute SARVIS"}
        >
          {audioOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
};
