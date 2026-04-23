import { Briefcase, Minus, Sparkles, Rocket, BarChart3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SlideStyleId =
  | "corporate"
  | "minimalist"
  | "creative"
  | "pitch"
  | "infographic";

export interface SlideStyleOption {
  id: SlideStyleId;
  label: string;
  description: string;
  swatch: string[];
  icon: React.ComponentType<{ className?: string }>;
}

export const SLIDE_STYLES: SlideStyleOption[] = [
  {
    id: "corporate",
    label: "Corporate / Business",
    description: "Polished navy + slate. Confident, executive, board-room ready.",
    swatch: ["#1E2761", "#06B6D4", "#F5F7FA"],
    icon: Briefcase,
  },
  {
    id: "minimalist",
    label: "Minimalist",
    description: "Lots of white space, refined serif headings, monochrome accents.",
    swatch: ["#212121", "#F2F2F2", "#F96167"],
    icon: Minus,
  },
  {
    id: "creative",
    label: "Creative / Modern",
    description: "Coral + indigo, bold display fonts, playful card layouts.",
    swatch: ["#F96167", "#2F3C7E", "#FFFFFF"],
    icon: Sparkles,
  },
  {
    id: "pitch",
    label: "Pitch Deck",
    description: "High-contrast hero slides, gradient blocks, founder-deck energy.",
    swatch: ["#990011", "#2F3C7E", "#FCF6F5"],
    icon: Rocket,
  },
  {
    id: "infographic",
    label: "Data / Infographic",
    description: "Teal palette, sidebar layout, optimised for charts and stats.",
    swatch: ["#028090", "#02C39A", "#F4FFFD"],
    icon: BarChart3,
  },
];

const STORAGE_KEY = "sarvis.lastSlideStyle";

export function getLastSlideStyle(): SlideStyleId | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return SLIDE_STYLES.some((s) => s.id === v) ? (v as SlideStyleId) : null;
}

export function rememberSlideStyle(id: SlideStyleId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

/** Suggest a different style than the last one used so decks vary. */
export function suggestNextStyle(): SlideStyleId {
  const last = getLastSlideStyle();
  const others = SLIDE_STYLES.filter((s) => s.id !== last);
  return others[Math.floor(Math.random() * others.length)].id;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (style: SlideStyleId) => void;
  topic?: string;
}

export function SlideStyleDialog({ open, onOpenChange, onPick, topic }: Props) {
  const last = getLastSlideStyle();
  const suggested = suggestNextStyle();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick a presentation style</DialogTitle>
          <DialogDescription>
            {topic ? (
              <>Generating slides for <span className="font-medium text-foreground">{topic}</span>. Choose a template — we'll remember it and rotate next time so your decks stay fresh.</>
            ) : (
              <>Choose a template. We remember your last pick and suggest a different one next time.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          {SLIDE_STYLES.map((s) => {
            const Icon = s.icon;
            const isLast = s.id === last;
            const isSuggested = s.id === suggested;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s.id)}
                className={cn(
                  "group flex flex-col items-start gap-2 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-md",
                  isSuggested ? "border-primary/60 bg-primary/5" : "border-border",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">{s.label}</span>
                  </div>
                  {isLast && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Last used
                    </span>
                  )}
                  {isSuggested && !isLast && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                      Suggested
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                <div className="flex gap-1.5">
                  {s.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-5 w-5 rounded-full border border-border/60"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
