import { useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SlideTheme {
  id: string;
  name: string;
  bg: string;
  titleBg: string;
  primary: string;
  accent: string;
  body: string;
  titleFg: string;
  fontHead: string;
  fontBody: string;
  layout: "topbar" | "sidebar" | "card" | "minimal" | "gradient";
}

export interface SlideOutline {
  title: string;
  subtitle?: string;
  slides: { title: string; bullets: string[] }[];
}

interface SlidePreviewProps {
  outline: SlideOutline;
  theme: SlideTheme;
}

const FALLBACK_THEME: SlideTheme = {
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
};

const hex = (h: string) => `#${h.replace(/^#/, "")}`;

/**
 * Renders a single slide at a fixed virtual size (1280x720) and scales it to fit
 * the parent. The parent must have a known width.
 */
function SlideCard({
  theme,
  isTitle,
  title,
  subtitle,
  bullets,
  scale = 1,
}: {
  theme: SlideTheme;
  isTitle?: boolean;
  title: string;
  subtitle?: string;
  bullets?: string[];
  scale?: number;
}) {
  const W = 1280;
  const H = 720;

  const titleX = theme.layout === "sidebar" ? 92 : (theme.layout === "card" ? 92 : 60);
  const contentTop = theme.layout === "topbar" ? 100 : 80;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md shadow-md"
      style={{
        width: W * scale,
        height: H * scale,
        background: hex(isTitle ? theme.titleBg : theme.bg),
      }}
    >
      <div
        style={{
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {/* ---- Title slide decorations ---- */}
        {isTitle && theme.layout === "gradient" && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 360,
              height: H,
              background: hex(theme.accent),
            }}
          />
        )}
        {isTitle && theme.layout === "sidebar" && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 38,
              height: H,
              background: hex(theme.accent),
            }}
          />
        )}

        {/* ---- Content slide decorations ---- */}
        {!isTitle && theme.layout === "topbar" && (
          <>
            <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 56, background: hex(theme.primary) }} />
            <div style={{ position: "absolute", left: 0, top: 56, width: W, height: 6, background: hex(theme.accent) }} />
          </>
        )}
        {!isTitle && theme.layout === "sidebar" && (
          <div style={{ position: "absolute", left: 0, top: 0, width: 48, height: H, background: hex(theme.primary) }} />
        )}
        {!isTitle && theme.layout === "card" && (
          <div
            style={{
              position: "absolute",
              left: 48,
              top: 48,
              width: W - 96,
              height: H - 96,
              background: "#ffffff",
              border: `1px solid ${hex(theme.accent)}`,
              borderRadius: 8,
            }}
          />
        )}
        {!isTitle && theme.layout === "gradient" && (
          <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: 56, background: hex(theme.primary) }} />
        )}

        {/* ---- Title ---- */}
        {isTitle ? (
          <>
            <div
              style={{
                position: "absolute",
                left: 80,
                top: 250,
                right: theme.layout === "gradient" ? 380 : 80,
                fontFamily: theme.fontHead,
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1.1,
                color: hex(theme.titleFg),
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  position: "absolute",
                  left: 80,
                  top: 430,
                  right: theme.layout === "gradient" ? 380 : 80,
                  fontFamily: theme.fontBody,
                  fontSize: 28,
                  color: hex(theme.accent),
                }}
              >
                {subtitle}
              </div>
            )}
          </>
        ) : (
          <>
            <div
              style={{
                position: "absolute",
                left: titleX,
                top: contentTop,
                right: 60,
                fontFamily: theme.fontHead,
                fontSize: 40,
                fontWeight: 800,
                color: hex(theme.primary),
              }}
            >
              {title}
            </div>
            <ul
              style={{
                position: "absolute",
                left: titleX + 12,
                top: contentTop + 80,
                right: 60,
                fontFamily: theme.fontBody,
                fontSize: 24,
                color: hex(theme.body),
                margin: 0,
                padding: 0,
                listStyle: "none",
              }}
            >
              {(bullets ?? []).map((b, i) => (
                <li
                  key={i}
                  style={{
                    paddingLeft: 24,
                    position: "relative",
                    marginBottom: 16,
                    lineHeight: 1.35,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 10,
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: hex(theme.accent),
                    }}
                  />
                  {b}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export const SlidePreview = ({ outline, theme: incomingTheme }: SlidePreviewProps) => {
  const theme = incomingTheme ?? FALLBACK_THEME;
  const [active, setActive] = useState(0);
  const [grid, setGrid] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // All slides: index 0 is the title slide
  const allSlides: { isTitle: boolean; title: string; subtitle?: string; bullets?: string[] }[] = [
    { isTitle: true, title: outline.title, subtitle: outline.subtitle },
    ...outline.slides.map((s) => ({ isTitle: false, title: s.title, bullets: s.bullets })),
  ];

  const total = allSlides.length;
  const cur = allSlides[Math.min(active, total - 1)];

  const go = (delta: number) => setActive((a) => Math.max(0, Math.min(total - 1, a + delta)));

  // Big preview scale: assumes parent canvas is roughly 600-700px wide.
  const mainScale = 0.45; // 1280 * 0.45 = 576 wide
  const thumbScale = 0.14; // 1280 * 0.14 ≈ 179 wide

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-background/60 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: hex(theme.primary) }}
            aria-hidden
          />
          <span className="font-medium text-foreground">{theme.name}</span>
          <span className="text-muted-foreground">·</span>
          <span>
            Slide {active + 1} / {total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setGrid((g) => !g)}
            className="h-8 gap-1.5"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">{grid ? "Single" : "Grid"}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFullscreen(true)}
            className="h-8 gap-1.5"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Present</span>
          </Button>
        </div>
      </div>

      {grid ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {allSlides.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setActive(i);
                  setGrid(false);
                }}
                className={cn(
                  "group relative flex flex-col items-stretch overflow-hidden rounded-lg border transition-all",
                  i === active
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-border hover:border-primary/50",
                )}
                aria-label={`Slide ${i + 1}: ${s.title}`}
              >
                <div className="flex items-center justify-center bg-muted/30 p-2">
                  <SlideCard
                    theme={theme}
                    isTitle={s.isTitle}
                    title={s.title}
                    subtitle={s.subtitle}
                    bullets={s.bullets}
                    scale={thumbScale}
                  />
                </div>
                <div className="border-t border-border bg-background px-2 py-1 text-left text-[11px] text-muted-foreground">
                  {i + 1}. <span className="text-foreground">{s.title}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center bg-muted/30 p-4">
            <SlideCard
              theme={theme}
              isTitle={cur.isTitle}
              title={cur.title}
              subtitle={cur.subtitle}
              bullets={cur.bullets}
              scale={mainScale}
            />
          </div>
          <div className="flex items-center justify-between border-t border-border bg-background/60 px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => go(-1)}
              disabled={active === 0}
              className="h-8 gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin px-2">
              {allSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === active ? "w-6 bg-primary" : "w-2 bg-border hover:bg-primary/50",
                  )}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => go(1)}
              disabled={active === total - 1}
              className="h-8 gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Fullscreen present mode */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 p-6"
          onClick={() => setFullscreen(false)}
          role="dialog"
          aria-label="Fullscreen presentation"
        >
          <div onClick={(e) => e.stopPropagation()}>
            <SlideCard
              theme={theme}
              isTitle={cur.isTitle}
              title={cur.title}
              subtitle={cur.subtitle}
              bullets={cur.bullets}
              scale={Math.min(
                (typeof window !== "undefined" ? window.innerWidth - 80 : 1200) / 1280,
                (typeof window !== "undefined" ? window.innerHeight - 160 : 700) / 720,
              )}
            />
          </div>
          <div className="mt-4 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => go(-1)}
              disabled={active === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-xs text-white/80">
              {active + 1} / {total}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => go(1)}
              disabled={active === total - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFullscreen(false)}
            >
              Exit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlidePreview;
