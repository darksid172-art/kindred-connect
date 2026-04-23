// Fetch top news headlines or topical news via NewsAPI.
// Re-saved to force redeployment.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, country, category, pageSize } = await req.json().catch(() => ({}));

    const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");
    if (!NEWS_API_KEY) {
      return new Response(JSON.stringify({ error: "NEWS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safePageSize = Math.min(Math.max(parseInt(pageSize) || 6, 1), 10);

    let url: string;
    if (typeof query === "string" && query.trim().length > 0) {
      const q = encodeURIComponent(query.trim().slice(0, 200));
      url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=${safePageSize}`;
    } else {
      const c = typeof country === "string" && /^[a-z]{2}$/i.test(country) ? country.toLowerCase() : "us";
      const cat =
        typeof category === "string" &&
        ["business", "entertainment", "general", "health", "science", "sports", "technology"].includes(
          category.toLowerCase(),
        )
          ? `&category=${category.toLowerCase()}`
          : "";
      url = `https://newsapi.org/v2/top-headlines?country=${c}${cat}&pageSize=${safePageSize}`;
    }

    const resp = await fetch(url, {
      headers: { "X-Api-Key": NEWS_API_KEY, "User-Agent": "SARVIS/1.0" },
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("NewsAPI error", resp.status, t);
      return new Response(
        JSON.stringify({ error: `NewsAPI error ${resp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const articles: NewsArticle[] = (data.articles ?? []).map((a: Record<string, unknown>) => ({
      title: String(a.title ?? "").trim(),
      description: a.description ? String(a.description).trim() : null,
      url: String(a.url ?? ""),
      source: String((a.source as Record<string, unknown>)?.name ?? "Unknown"),
      publishedAt: String(a.publishedAt ?? ""),
      imageUrl: a.urlToImage ? String(a.urlToImage) : null,
    }));

    return new Response(
      JSON.stringify({ articles, query: query ?? null, totalResults: data.totalResults ?? articles.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("get-news error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
