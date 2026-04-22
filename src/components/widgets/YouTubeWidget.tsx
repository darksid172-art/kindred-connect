import { useEffect, useRef, useState } from "react";
import { Youtube, Loader2, RefreshCw, Users, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getYouTubeChannel, type YouTubeChannel } from "@/lib/google";

const STORAGE_KEY = "yt_last_subscribers";
const POLL_MS = 3 * 60 * 1000; // 3 minutes

export const YouTubeWidget = () => {
  const [channel, setChannel] = useState<YouTubeChannel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastNotifiedRef = useRef<number | null>(null);

  const fetchChannel = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const r = await getYouTubeChannel();
    if (!silent) setLoading(false);
    if (r.error) {
      if (!silent) setError(r.error);
      return;
    }
    if (!r.channel) return;
    setChannel(r.channel);

    if (r.channel.subscriberHidden) return;
    const stored = lastNotifiedRef.current;
    if (stored !== null && r.channel.subscriberCount > stored) {
      const diff = r.channel.subscriberCount - stored;
      toast.success(
        `🎉 ${diff} new subscriber${diff > 1 ? "s" : ""}! Congrats — you're at ${r.channel.subscriberCount.toLocaleString()}.`,
        { duration: 8000 },
      );
    }
    lastNotifiedRef.current = r.channel.subscriberCount;
    localStorage.setItem(STORAGE_KEY, String(r.channel.subscriberCount));
  };

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) lastNotifiedRef.current = parseInt(stored);
    fetchChannel();
    const id = setInterval(() => fetchChannel(true), POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-foreground/80" />
          <h3 className="text-sm font-semibold">YouTube</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchChannel()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </header>
      <div className="p-4">
        {error && <div className="text-xs text-destructive">{error}</div>}
        {!error && !channel && <Skeleton className="h-24 w-full" />}
        {channel && (
          <div className="flex items-center gap-3">
            {channel.thumbnail && (
              <img src={channel.thumbnail} alt={channel.title} className="h-14 w-14 rounded-full border border-border" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{channel.title}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {channel.subscriberHidden ? (
                  <span>Subscribers hidden</span>
                ) : (
                  <span className="tabular-nums">{channel.subscriberCount.toLocaleString()} subscribers</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground/80 tabular-nums">
                {channel.videoCount} videos · {channel.viewCount.toLocaleString()} views
              </div>
            </div>
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
