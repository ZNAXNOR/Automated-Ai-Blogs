import {searchCse, SearchResult, SearchOpts} from "./googleCse.client";
import axios from "axios";

interface ClientOpts extends SearchOpts {
  useFallback?: boolean;
}

export type SerpApiOptions = SearchOpts & { apiKey: string };

/**
 * Searches with SerpApi.
 * @param {string} query The search query.
 * @param {SerpApiOptions} opts The search options.
 * @return {Promise<SearchResult[]>} The search results.
 */
async function gsearchSerpApi(
  query: string,
  opts: SerpApiOptions
): Promise<SearchResult[]> {
  const {
    num = 10, start = 1, language, siteSearch, timeoutMs = 10_000, apiKey,
  } = opts;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = resp.data as { organic_results?: any[], organic?: any[] };
  const items = data.organic_results ?? data.organic ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.map((it: any, idx: number) => ({
    title: it.title,
    snippet: it.snippet || it.snippet_highlighted || "",
    url: it.link || it.url,
    displayLink: it.source,
    position: start + idx,
  }));
}

export type SearchClientOpts = ClientOpts & {
  cseKey?: string;
  cseCx?: string;
  serpApiKey?: string;
};

/**
 * Searches with Google Search, using either CSE or SerpApi.
 * @param {string} query The search query.
 * @param {SearchClientOpts} opts The search options.
 * @return {Promise<SearchResult[]>} The search results.
 */
export async function search(
  query: string,
  opts: SearchClientOpts = {}
): Promise<SearchResult[]> {
  const {useFallback = true, ...rest} = opts;

  const cseKey = opts.cseKey || process.env.GOOGLE_CSE_API_KEY;
  const cseCx = opts.cseCx || process.env.GOOGLE_CSE_CX;
  const serpApiKey = opts.serpApiKey || process.env.SERPAPI_KEY;

  if (cseKey && cseCx) {
    try {
      return await searchCse(query, {...rest, apiKey: cseKey, cx: cseCx});
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[searchClient] CSE failed, fallback: ${errorMessage}`);
      if (useFallback && serpApiKey) {
        return await gsearchSerpApi(query, {...rest, apiKey: serpApiKey});
      }
      throw err;
    }
  }

  if (serpApiKey) {
    return await gsearchSerpApi(query, {...rest, apiKey: serpApiKey});
  }

  throw new Error("No search provider configured. " +
    "Ensure GOOGLE_CSE_API_KEY & GOOGLE_CSE_CX or SERPAPI_KEY is set.");
}
