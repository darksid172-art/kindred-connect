// Find places near a coordinate using OpenStreetMap Overpass API.
// No API key required. Returns POIs of the requested category within radius (meters).
// (Inlined to ensure the function deploys as a self-contained unit.)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA = "SARVIS/1.0 (https://lovable.app)";

// Map a free-text category to Overpass tag filters.
function buildOverpassQuery(category: string, lat: number, lon: number, radius: number): string {
  const c = category.toLowerCase().trim();
  let filter = `["amenity"~"restaurant|cafe|fast_food|bar|pub"]`;
  if (/coffee|cafe|café/.test(c)) filter = `["amenity"~"cafe|coffee_shop"]`;
  else if (/restaurant|food|eat|dinner|lunch/.test(c)) filter = `["amenity"~"restaurant|fast_food"]`;
  else if (/bar|pub|drink/.test(c)) filter = `["amenity"~"bar|pub"]`;
  else if (/gas|fuel|petrol/.test(c)) filter = `["amenity"="fuel"]`;
  else if (/atm|bank/.test(c)) filter = `["amenity"~"atm|bank"]`;
  else if (/pharmacy|drug/.test(c)) filter = `["amenity"="pharmacy"]`;
  else if (/hospital|clinic|doctor/.test(c)) filter = `["amenity"~"hospital|clinic|doctors"]`;
  else if (/hotel|motel|stay|lodging/.test(c)) filter = `["tourism"~"hotel|motel|hostel|guest_house"]`;
  else if (/park|garden/.test(c)) filter = `["leisure"~"park|garden"]`;
  else if (/gym|fitness/.test(c)) filter = `["leisure"="fitness_centre"]`;
  else if (/super.?market|grocery|store|shop/.test(c)) filter = `["shop"~"supermarket|convenience|grocery"]`;
  else if (/school|university/.test(c)) filter = `["amenity"~"school|university|college"]`;
  else if (/library/.test(c)) filter = `["amenity"="library"]`;
  else if (/cinema|movie|theater/.test(c)) filter = `["amenity"~"cinema|theatre"]`;

  return `[out:json][timeout:20];(node${filter}(around:${radius},${lat},${lon});way${filter}(around:${radius},${lat},${lon}););out center 30;`;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

async function runOverpass(query: string): Promise<Record<string, any>> {
  let lastErr: unknown = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "text/plain" },
        body: query,
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) return await r.json();
      lastErr = new Error(`Overpass ${r.status} from ${new URL(url).host}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All Overpass mirrors failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    const category = String(body.category ?? "restaurant");
    // Allow up to 25 km — useful in low-density rural areas.
    const radius = Math.min(Math.max(parseInt(body.radius) || 1500, 200), 25000);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return new Response(JSON.stringify({ error: "lat & lon required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try the requested category, then progressively widen the search if empty.
    const attempts: { cat: string; radius: number }[] = [
      { cat: category, radius },
      { cat: category, radius: Math.min(radius * 2, 25000) },
      { cat: "restaurant", radius: Math.min(radius * 2, 25000) },
    ];

    let data: Record<string, any> = { elements: [] };
    let usedRadius = radius;
    let usedCategory = category;
    for (const a of attempts) {
      const q = buildOverpassQuery(a.cat, lat, lon, a.radius);
      data = await runOverpass(q);
      if ((data.elements ?? []).length > 0) {
        usedRadius = a.radius;
        usedCategory = a.cat;
        break;
      }
    }

    const places = (data.elements ?? [])
      .map((el: Record<string, any>) => {
        const plat = el.lat ?? el.center?.lat;
        const plon = el.lon ?? el.center?.lon;
        if (!Number.isFinite(plat) || !Number.isFinite(plon)) return null;
        const tags = el.tags ?? {};
        // Haversine distance
        const R = 6371000;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(plat - lat);
        const dLon = toRad(plon - lon);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat)) * Math.cos(toRad(plat)) * Math.sin(dLon / 2) ** 2;
        const distance = Math.round(2 * R * Math.asin(Math.sqrt(a)));
        return {
          id: String(el.id),
          name: tags.name ?? "(unnamed)",
          category: tags.amenity ?? tags.shop ?? tags.tourism ?? tags.leisure ?? "place",
          address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]]
            .filter(Boolean)
            .join(" "),
          lat: plat,
          lon: plon,
          distance,
          osmUrl: `https://www.openstreetmap.org/?mlat=${plat}&mlon=${plon}#map=18/${plat}/${plon}`,
        };
      })
      .filter((p: unknown) => p !== null && (p as { name: string }).name !== "(unnamed)")
      .sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance)
      .slice(0, 20);

    return new Response(JSON.stringify({ center: { lat, lon }, category: usedCategory, radius: usedRadius, places }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("maps-nearby error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error", places: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
