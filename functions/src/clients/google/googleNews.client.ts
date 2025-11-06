import fetch from "node-fetch";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchNewsForTopics(topics: string[]): Promise<string[]> {
  console.log(`[googleNewsClient] Fetching news for topics: ${topics.join(", ")}`);

  // Combine topics (assumed sanitized from r0 / r1)
  // Truncate or limit aggregate query string to safe length
  const maxQueryLen = 100;
  // Join with OR, but ensure total length under maxQueryLen
  let rawQuery = topics.filter(Boolean).join(" OR ");
  if (rawQuery.length > maxQueryLen) {
    rawQuery = rawQuery.slice(0, maxQueryLen);
    console.log(`[googleNewsClient] Truncated query to ${rawQuery.length} chars.`);
  }
  const encodedQuery = encodeURIComponent(rawQuery);
  console.log(`[googleNewsClient] Query: ${rawQuery}`);

  // Time filters
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fromDate = sevenDaysAgo.toISOString().split("T")[0];
  const fromDateTime = sevenDaysAgo.toISOString();

  const newsdataKey = process.env.NEWSDATA_API;
  const gnewsKey = process.env.GNEWS_API;
  const headlines: string[] = [];

  // --- Try NewsData.io (qInTitle first) ---
  if (newsdataKey) {
    console.log(`[googleNewsClient] 🔍 NewsData.io qInTitle (since ${fromDate})`);
    try {
      // Try title-only match
      let url = `https://newsdata.io/api/1/latest?apikey=${newsdataKey}&qInTitle=${encodedQuery}&language=en&country=us&from_date=${fromDate}`;
      let res = await fetch(url);
      let data: any = await res.json();

      if (!data?.results?.length) {
        console.log("[googleNewsClient] No results with qInTitle, trying q parameter");
        url = `https://newsdata.io/api/1/latest?apikey=${newsdataKey}&q=${encodedQuery}&language=en&country=us&from_date=${fromDate}`;
        res = await fetch(url);
        data = await res.json();
      }

      if (data?.results?.length) {
        const found = data.results
          .slice(0, 5)
          .map((a: any) => `${a.title?.trim()} — ${a.source_id || "Unknown"}`)
          .filter(Boolean);
        headlines.push(...found);
        console.log(`[googleNewsClient] ✅ Found ${found.length} headlines from NewsData.io`);
      } else {
        console.log("[googleNewsClient] No results from NewsData.io");
      }
    } catch (err: any) {
      console.warn("[googleNewsClient] NewsData.io fetch error:", err.message);
    }
  } else {
    console.log("[googleNewsClient] NewsData API key missing, skipping NewsData.");
  }

  // --- Fallback to GNews Search if insufficient headlines ---
  if (headlines.length < 3 && gnewsKey) {
    console.log(`[googleNewsClient] Fallback → GNews Search (since ${fromDateTime})`);
    await sleep(300); // small delay
    try {
      const url = `https://gnews.io/api/v4/search?q=${encodedQuery}&token=${gnewsKey}&lang=en&country=us&max=5&from=${fromDateTime}`;
      const res = await fetch(url);
      const data: any = await res.json();

      if (data?.articles?.length) {
        const found = data.articles
          .slice(0, 5)
          .map((a: any) => `${a.title?.trim()} — ${a.source?.name || "Unknown"}`)
          .filter(Boolean);
        headlines.push(...found);
        console.log(`[googleNewsClient] ✅ Found ${found.length} headlines from GNews`);
      } else {
        console.log("[googleNewsClient] No results from GNews");
      }
    } catch (err: any) {
      console.warn("[googleNewsClient] GNews fetch error:", err.message);
    }
  } else if (!gnewsKey) {
    console.log("[googleNewsClient] GNews API key missing, skipping GNews.");
  }

  // Deduplicate and trim whitespace
  const unique = [...new Set(headlines.map((h) => h.trim()))];
  console.log(`[googleNewsClient] Returning ${unique.length} headlines.`);
  return unique;
}
