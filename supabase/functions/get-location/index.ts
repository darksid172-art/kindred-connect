const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Free, no-API-key alternative to Google Maps:
//   - Geocoding: OpenStreetMap Nominatim
//   - Reverse geocoding: OpenStreetMap Nominatim
//   - Routing: OSRM public demo server
// Nominatim usage policy requires a User-Agent identifying the app.

const UA = "SARVIS/1.0 (https://lovable.app)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "geocode";

    if (action === "geocode") {
      const q = String(body.query ?? "").trim().slice(0, 200);
      if (!q) {
        return new Response(JSON.stringify({ error: "query required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
      const data = await r.json();
      const results = (data ?? []).map((p: Record<string, unknown>) => ({
        displayName: p.display_name,
        lat: parseFloat(String(p.lat)),
        lon: parseFloat(String(p.lon)),
        type: p.type,
        importance: p.importance,
        // Static map preview via OSM staticmap (no key)
        previewUrl: `https://staticmap.openstreetmap.de/staticmap.php?center=${p.lat},${p.lon}&zoom=13&size=600x300&markers=${p.lat},${p.lon},red-pushpin`,
        osmUrl: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=14/${p.lat}/${p.lon}`,
      }));
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reverse") {
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return new Response(JSON.stringify({ error: "lat & lon required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
      const data = await r.json();
      return new Response(
        JSON.stringify({
          displayName: data.display_name ?? null,
          address: data.address ?? null,
          osmUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "route") {
      // body.from = [lon,lat]; body.to = [lon,lat]
      const from = body.from as [number, number];
      const to = body.to as [number, number];
      if (!Array.isArray(from) || !Array.isArray(to)) {
        return new Response(JSON.stringify({ error: "from & to [lon,lat] required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=false`;
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      const data = await r.json();
      const route = data.routes?.[0];
      return new Response(
        JSON.stringify({
          distanceMeters: route?.distance ?? null,
          durationSeconds: route?.duration ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-location error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
