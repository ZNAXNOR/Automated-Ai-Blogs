/**
 * SerpApi client helpers.
 * If SERP_API_KEY absent, module gracefully degrades: functions return [] and serpAvailable() is false.
 */

import { env } from "../../utils/config";

const BASE = "https://serpapi.com";

export function serpAvailable() {
  return !!env.SERP_API_KEY;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`SerpApi error ${res.status}`);
  return res.json();
}

/**
 * Autocomplete suggestions for each seed; merges results.
 * Uses Google Autocomplete endpoint on SerpApi.
 */
export async function getSerpSuggestions(seeds: string[], region?: string): Promise<string[]> {
  if (!serpAvailable()) return [];
  const out = new Set<string>();
  for (const q of seeds) {
    const url = `${BASE}/search.json?engine=google_autocomplete&q=${encodeURIComponent(q)}&hl=en&gl=${encodeURIComponent(
      region || "us"
    )}&api_key=${env.SERP_API_KEY}`;
    try {
      const json = await fetchJson(url);
      const suggestions: any[] = json?.suggestions || json?.suggested_queries || [];
      for (const s of suggestions) {
        if (typeof s === "string") out.add(s);
        else if (s?.value) out.add(String(s.value));
        else if (s?.query) out.add(String(s.query));
      }
    } catch (e) {
      console.warn("SerpApi autocomplete error:", e);
    }
  }
  return [...out];
}

/**
 * Related queries from Google "related searches" via SerpApi (web engine).
 */
export async function getSerpRelated(seeds: string[], region?: string): Promise<string[]> {
  if (!serpAvailable()) return [];
  const out = new Set<string>();
  for (const q of seeds) {
    const url = `${BASE}/search.json?engine=google&q=${encodeURIComponent(q)}&hl=en&gl=${encodeURIComponent(
      region || "us"
    )}&api_key=${env.SERP_API_KEY}`;
    try {
      const json = await fetchJson(url);
      const related: any[] =
        json?.related_questions || json?.related_searches || json?.related || json?.people_also_search_for || [];
      for (const r of related) {
        if (typeof r === "string") out.add(r);
        else if (r?.question) out.add(String(r.question));
        else if (r?.query) out.add(String(r.query));
        else if (r?.title) out.add(String(r.title));
      }
    } catch (e) {
      console.warn("SerpApi related error:", e);
    }
  }
  return [...out];
}

/**
 * Trending queries — use Google Trends via SerpApi if available; else empty.
 */
export async function getSerpTrending(region?: string): Promise<string[]> {
  if (!serpAvailable()) return [];
  const url = `${BASE}/search.json?engine=google_trends_trending_now&hl=en&gl=${encodeURIComponent(
    region || "us"
  )}&api_key=${env.SERP_API_KEY}`;

  try {
    const json = await fetchJson(url);
    const trends: any[] = json?.trending_searches || json?.trending || [];
    const out = new Set<string>();
    for (const t of trends) {
      if (typeof t === "string") out.add(t);
      else if (t?.query) out.add(String(t.query));
      else if (t?.title) out.add(String(t.title));
      else if (t?.search_term) out.add(String(t.search_term));
    }
    return [...out];
  } catch (e) {
    console.warn("SerpApi trending error:", e);
    return [];
  }
}
