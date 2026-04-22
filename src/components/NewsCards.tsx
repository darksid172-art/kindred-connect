import type { NewsArticle } from "@/lib/sarvis";
import { ExternalLink, Newspaper } from "lucide-react";

interface NewsCardsProps {
  articles: NewsArticle[];
  query?: string | null;
}

const formatDate = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const NewsCards = ({ articles, query }: NewsCardsProps) => {
  if (!articles || articles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground italic font-serif">
        No news articles found{query ? ` for "${query}"` : ""}.
      </div>
    );
  }

  return (
    <section
      className="not-prose rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-4 sm:p-5 space-y-4 font-serif"
      aria-label="News results"
    >
      <header className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-foreground/80" />
          <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
            {query ? `Latest on "${query}"` : "Top Headlines"}
          </h3>
        </div>
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {articles.length} stories
        </span>
      </header>

      <ol className="space-y-4">
        {articles.map((a, i) => (
          <li
            key={`${a.url}-${i}`}
            className="group flex gap-3 sm:gap-4 border-b border-border/40 pb-4 last:border-b-0 last:pb-0"
          >
            <span className="text-2xl font-bold text-muted-foreground/60 leading-none mt-0.5 w-6 shrink-0 tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>

            {a.imageUrl && (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 hidden sm:block"
              >
                <img
                  src={a.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-20 w-28 object-cover rounded-md border border-border"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </a>
            )}

            <div className="flex-1 min-w-0 space-y-1.5">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[15px] sm:text-base font-semibold leading-snug text-foreground group-hover:underline underline-offset-2 decoration-foreground/40"
              >
                {a.title}
              </a>
              {a.description && (
                <p className="text-[13px] sm:text-sm leading-relaxed text-muted-foreground italic">
                  {a.description}
                </p>
              )}
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground/80 pt-1">
                <span className="font-sans font-medium not-italic">{a.source}</span>
                {a.publishedAt && (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                  </>
                )}
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  aria-label="Open article"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <footer className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 text-center pt-1">
        Powered by NewsAPI
      </footer>
    </section>
  );
};
