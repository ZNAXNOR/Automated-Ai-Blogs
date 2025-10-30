import { searchCse, SearchResult, SearchOpts } from "./googleCse.client";
import axios from "axios";

interface ClientOpts extends SearchOpts {
  useFallback?: boolean;
}

async function gsearchSerpApi(
  query: string,
  opts: SearchOpts & { apiKey: string }
): Promise<SearchResult[]> {
  const { num = 10, start = 1, language, siteSearch, timeoutMs = 10_000, apiKey } = opts;
  const q = siteSearch ? `${query} site:${siteSearch}` : query;
  const resp = await axios.get("https://serpapi.com/search.json", {
    params: {
      q,
      api_key: apiKey,
      start,
      num,
      hl: language,
      engine: "google",
    },
    timeout: timeoutMs,
  });
  const data = resp.data;
  const items = data.organic_results ?? data.organic ?? [];
  return items.map((it: any, idx: number) => ({
    title: it.title,
    snippet: it.snippet || it.snippet_highlighted || "",
    url: it.link || it.url,
    displayLink: it.source,
    position: start + idx,
  }));
}

export async function search(
  query: string,
  opts: ClientOpts & { cseKey?: string; cseCx?: string; serpApiKey?: string } = {}
): Promise<SearchResult[]> {
  const { useFallback = true, ...rest } = opts;
  
  const cseKey = opts.cseKey || process.env.GOOGLE_CSE_API_KEY;
  const cseCx = opts.cseCx || process.env.GOOGLE_CSE_CX;
  const serpApiKey = opts.serpApiKey || process.env.SERPAPI_KEY;

  if (cseKey && cseCx) {
    try {
      return await searchCse(query, { ...rest, apiKey: cseKey, cx: cseCx });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[searchClient] CSE failed, fallback: ${errorMessage}`);
      if (useFallback && serpApiKey) {
        return await gsearchSerpApi(query, { ...rest, apiKey: serpApiKey });
      }
      throw err;
    }
  }

  if (serpApiKey) {
    return await gsearchSerpApi(query, { ...rest, apiKey: serpApiKey });
  }

  throw new Error("No search provider configured. Ensure GOOGLE_CSE_API_KEY & GOOGLE_CSE_CX or SERPAPI_KEY is set in your environment.");
}
