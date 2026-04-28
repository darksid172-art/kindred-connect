import { useEffect, useRef, useState } from "react";
import { Youtube, Loader2, RefreshCw, Users, PartyPopper, Eye, ThumbsUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getYouTubeAnalytics, type YouTubeAnalytics } from "@/lib/google";

const STORAGE_KEY = "yt_last_subscribers";
const POLL_MS = 3 * 60 * 1000; // 3 minutes

export const YouTubeWidget = () => {
  const [data, setData] = useState<YouTubeAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastNotifiedRef = useRef<number | null>(null);

  const fetchAnalytics = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const r = await getYouTubeAnalytics();
    if (!silent) setLoading(false);
    if (r.error) {
      if (!silent) setError(r.error);
      return;
    }
    if (!r.analytics) return;
    setData(r.analytics);

    const ch = r.analytics.channel;
    if (ch.subscriberHidden) return;
    const stored = lastNotifiedRef.current;
    if (stored !== null && ch.subscriberCount > stored) {
      const diff = ch.subscriberCount - stored;
      toast.success(
        `🎉 ${diff} new subscriber${diff > 1 ? "s" : ""}! Congrats — you're at ${ch.subscriberCount.toLocaleString()}.`,
        { duration: 8000 },
      );
    }
    lastNotifiedRef.current = ch.subscriberCount;
    localStorage.setItem(STORAGE_KEY, String(ch.subscriberCount));
  };

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) lastNotifiedRef.current = parseInt(stored);
    fetchAnalytics();
    const id = setInterval(() => fetchAnalytics(true), POLL_MS);
    return () => clearInterval(id);
  }, []);

  const ch = data?.channel;
  const recent = data?.recent ?? [];

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-foreground/80" />
          <h3 className="text-sm font-semibold">YouTube</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchAnalytics()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </header>
      <div className="p-4">
        {error && <div className="text-xs text-destructive">{error}</div>}
        {!error && !data && <Skeleton className="h-24 w-full" />}
        {ch && (
          <div className="flex items-center gap-3">
            {ch.thumbnail && (
              <img src={ch.thumbnail} alt={ch.title} className="h-14 w-14 rounded-full border border-border" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{ch.title}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {ch.subscriberHidden ? (
                  <span>Subscribers hidden</span>
                ) : (
                  <span className="tabular-nums">{ch.subscriberCount.toLocaleString()} subscribers</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground/80 tabular-nums">
                {ch.videoCount} videos · {ch.viewCount.toLocaleString()} views
              </div>
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent videos
            </div>
            <ol className="max-h-72 space-y-2 overflow-auto pr-1">
              {recent.slice(0, 8).map((v) => (
                <li key={v.videoId}>
                  <a
                    href={`https://youtu.be/${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 rounded-lg p-1.5 hover:bg-secondary/40 transition-colors"
                  >
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      loading="lazy"
                      className="h-12 w-20 shrink-0 rounded object-cover border border-border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs font-medium text-foreground">{v.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
                        <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{v.views.toLocaleString()}</span>
                        <span className="flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" />{v.likes.toLocaleString()}</span>
                        <span className="flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{v.comments.toLocaleString()}</span>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          <PartyPopper className="h-3 w-3" />
          Auto-checks every 3 min — you'll get a toast when new subs come in.
        </div>
      </div>
    </div>
  );
};
