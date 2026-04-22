import { useEffect, useState } from "react";
import { Newspaper, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getNews, type NewsArticle } from "@/lib/sarvis";

export const NewsWidget = () => {
  const [articles, setArticles] = useState<NewsArticle[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    const r = await getNews({ pageSize: 6 });
    if (r.error) setError(r.error);
    else setArticles(r.articles ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-foreground/80" />
          <h3 className="text-sm font-semibold">Top Headlines</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </header>
      <div className="max-h-[360px] flex-1 overflow-auto">
        {error && <div className="p-4 text-xs text-destructive">{error}</div>}
        {!error && articles === null && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {articles?.length === 0 && <div className="p-4 text-xs text-muted-foreground">No news right now.</div>}
        {articles && articles.length > 0 && (
          <ol className="divide-y divide-border">
            {articles.map((a, i) => (
              <li key={`${a.url}-${i}`} className="px-4 py-2.5">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-medium text-foreground hover:underline"
                >
                  {a.title}
                </a>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground/80">
                  {a.source}
                  {a.publishedAt && (
                    <> · {new Date(a.publishedAt).toLocaleDateString()}</>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
