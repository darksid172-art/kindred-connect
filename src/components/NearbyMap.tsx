import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NearbyPlace } from "@/lib/google";

// Fix default marker icon paths for bundlers
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const meIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:hsl(var(--primary));border:3px solid white;box-shadow:0 0 0 2px hsl(var(--primary)/0.4),0 0 12px hsl(var(--primary)/0.6)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map(([la, lo]) => L.latLng(la, lo)));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [points, map]);
  return null;
}

interface NearbyMapProps {
  center: { lat: number; lon: number };
  radius: number;
  places: NearbyPlace[];
  category?: string;
}

export const NearbyMap = ({ center, radius, places, category }: NearbyMapProps) => {
  const points = useMemo<[number, number][]>(
    () => [[center.lat, center.lon], ...places.map<[number, number]>((p) => [p.lat, p.lon])],
    [center, places],
  );
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div className="not-prose rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">
          {places.length} {category || "places"} near you
        </h3>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {(radius / 1000).toFixed(1)} km radius
        </span>
      </header>
      <div className="h-[320px] w-full">
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={14}
          scrollWheelZoom={false}
          className="h-full w-full"
          ref={(m) => {
            if (m) mapRef.current = m;
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={[center.lat, center.lon]}
            radius={radius}
            pathOptions={{ color: "hsl(var(--primary))", weight: 1, fillOpacity: 0.05 }}
          />
          <Marker position={[center.lat, center.lon]} icon={meIcon}>
            <Popup>You are here</Popup>
          </Marker>
          {places.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lon]}>
              <Popup>
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-muted-foreground capitalize">{p.category}</div>
                  {p.address && <div>{p.address}</div>}
                  <div className="text-muted-foreground">{p.distance} m away</div>
                  <a href={p.osmUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    Open in OSM
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
          <FitBounds points={points} />
        </MapContainer>
      </div>
      {places.length > 0 && (
        <ol className="max-h-48 divide-y divide-border overflow-auto text-sm">
          {places.slice(0, 8).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground capitalize">
                  {p.category} {p.address && `· ${p.address}`}
                </div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground tabular-nums">{p.distance} m</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
