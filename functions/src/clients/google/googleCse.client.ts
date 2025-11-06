import axios from "axios";

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  displayLink?: string;
  position?: number;
}

export interface SearchOpts {
  num?: number;
  start?: number;
  language?: string;
  siteSearch?: string;
  timeoutMs?: number;
}

export async function searchCse(
  query: string,
  opts: SearchOpts & { apiKey: string; cx: string }
): Promise<SearchResult[]> {
  const {num = 10, start = 1, language, siteSearch, timeoutMs = 10_000, apiKey, cx} = opts;
  const q = siteSearch ? `${query} site:${siteSearch}` : query;
  const resp = await axios.get("https://www.googleapis.com/customsearch/v1", {
    params: {
      key: apiKey,
      cx,
      q,
      num,
      start,
      lr: language ? `lang_${language}` : undefined,
    },
    timeout: timeoutMs,
  });
  const data = resp.data;
  if (!Array.isArray(data.items)) return [];
  return data.items.map((item: any, idx: number) => ({
    title: item.title,
    snippet: item.snippet || item.htmlSnippet || "",
    url: item.link,
    displayLink: item.displayLink,
    position: (data.queries?.request?.[0]?.startIndex ?? 1) + idx,
  }));
}
