import { useEffect, useState } from "react";
import { Cloud, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeather, type WeatherForecast } from "@/lib/sarvis";
import { loadSettings } from "@/lib/settings";

export const WeatherWidget = () => {
  const [data, setData] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    // Try precise geolocation first; fall back to user country.
    const tryGeo = () =>
      new Promise<{ lat: number; lon: number } | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => resolve(null),
          { timeout: 5000 },
        );
      });
    const coords = await tryGeo();
    const params = coords ?? { place: loadSettings().userProfile?.country || "" };
    const r = await getWeather(params);
    if (r.error) setError(r.error);
    else setData(r.forecast ?? null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-foreground/80" />
          <h3 className="text-sm font-semibold">Weather</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </header>
      <div className="p-4">
        {error && <div className="text-xs text-destructive">{error}</div>}
        {!error && !data && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {data && (
          <>
            <div className="mb-3">
              <div className="text-3xl font-semibold leading-none">
                {Math.round(data.current.temp)}°C
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {data.place ?? "Your location"} · {data.current.summary}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground/80">
                Feels {Math.round(data.current.feelsLike)}° · 💧{data.current.humidity}% · 🌬 {Math.round(data.current.wind)} km/h
              </div>
            </div>
            <ol className="space-y-1.5 text-xs">
              {data.days.slice(0, 4).map((d) => {
                const date = new Date(d.date);
                const day = date.toLocaleDateString(undefined, { weekday: "short" });
                return (
                  <li key={d.date} className="flex items-center justify-between gap-2 border-t border-border/40 pt-1.5">
                    <span className="w-10 text-muted-foreground">{day}</span>
                    <span className="flex-1 truncate text-foreground/80">{d.summary}</span>
                    <span className="text-muted-foreground">💧{d.pop}%</span>
                    <span className="font-medium tabular-nums">
                      {Math.round(d.tMin)}° / {Math.round(d.tMax)}°
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
};
