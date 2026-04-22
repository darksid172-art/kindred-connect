import { useEffect, useState } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { findNearby, type NearbyPlace } from "@/lib/google";
import { NearbyMap } from "@/components/NearbyMap";

export const MapsWidget = () => {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [category, setCategory] = useState("restaurant");
  const [loading, setLoading] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setPermError("Geolocation is not supported in this browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setPermError(null);
        setLoading(false);
      },
      (err) => {
        setPermError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const search = async () => {
    if (!coords) {
      requestLocation();
      return;
    }
    setLoading(true);
    const r = await findNearby({ lat: coords.lat, lon: coords.lon, category, radius: 1500 });
    setLoading(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    setPlaces(r.places ?? []);
  };

  useEffect(() => {
    if (coords) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-foreground/80" />
          <h3 className="text-sm font-semibold">Nearby</h3>
        </div>
      </header>
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="restaurant, cafe, gas, pharmacy…"
            onKeyDown={(e) => e.key === "Enter" && search()}
            className="h-9"
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={search} disabled={loading || !coords}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {permError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            Location blocked: {permError}
            <Button variant="link" size="sm" className="h-auto p-0 ml-2" onClick={requestLocation}>
              Retry
            </Button>
          </div>
        )}
        {coords && places.length > 0 && (
          <NearbyMap center={coords} radius={1500} places={places} category={category} />
        )}
        {coords && !loading && places.length === 0 && !permError && (
          <div className="text-xs text-muted-foreground">No results yet — try another category.</div>
        )}
      </div>
    </div>
  );
};
