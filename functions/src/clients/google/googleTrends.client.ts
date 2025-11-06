import axios from "axios";
import {normalizeTopicList} from "../../utils/normalize.util.js";

interface GoogleTrendsParams {
  topic: string;
  geo?: string;
  timeframe: string;
  category?: number;
  apiKey: string;
}

interface CacheEntry {
  data: {
    suggestions: { topic: string, score: number }[],
    trendTimeline: { time: Date, value: number }[]
  };
  fetchedAt: number;
}

interface RelatedQuery {
  query: string;
  extracted_value?: string;
  value?: string;
}

interface TimelinePoint {
  date: string;
  values: {
    extracted_value?: string;
    value?: string;
  }[];
}

interface SerpApiResponse {
  related_queries?: {
    rising: RelatedQuery[];
    top: RelatedQuery[];
  };
  interest_over_time?: {
    timeline_data: TimelinePoint[];
  };
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 5; // 5 days

/**
 * Processes the raw SerpAPI response to extract suggestions and trend data.
 * @param {SerpApiResponse} data The raw data from the SerpAPI.
 * @return {{suggestions: {topic: string, score: number}[],
 * trendTimeline: {time: Date, value: number}[]}} The processed data.
 */
function processSerpApiResponse(data: SerpApiResponse) {
  // ✅ Extract *all* related queries (rising + top)
  const rising = Array.isArray(data.related_queries?.rising) ?
    data.related_queries.rising :
    [];
  const top = Array.isArray(data.related_queries?.top) ?
    data.related_queries.top :
    [];

  const related = [...rising, ...top];

  const suggestions = related.map((rq: RelatedQuery) => ({
    topic: rq.query ?? "unknown",
    score: parseFloat((rq.extracted_value ?? rq.value ?? 0).toString()) || 0,
  }));

  // ✅ Extract full timeline
  const timeline = (data.interest_over_time?.timeline_data ?? []).map(
    (pt: TimelinePoint) => {
      const v = pt.values?.[0];
      const num = parseFloat(
        (v?.extracted_value ?? v?.value ?? 0).toString()
      ) || 0;
      return {time: new Date(pt.date), value: num};
    });

  const cleanSuggestions = normalizeTopicList(suggestions);

  return {
    suggestions: cleanSuggestions,
    trendTimeline: timeline,
  };
}

/**
 * @param {GoogleTrendsParams} params The parameters for the request.
 * @return {Promise<{suggestions: {topic: string, score: number}[],
 * trendTimeline: {time: Date, value: number}[]}>} The trends data.
 */
export async function fetchGoogleTrends(params: GoogleTrendsParams) {
  const {topic, geo, timeframe, category = 0, apiKey} = params;
  const cacheKey = `${topic}_${geo}_${timeframe}_${category}`
    .toLowerCase().replace(/\s+/g, "_");

  // 1️⃣ Cache check
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    console.log(`[googleTrendsClient] Using cached data for ${cacheKey}`);
    return cached.data;
  }

  const apiParams: Record<string, string | boolean | number> = {
    engine: "google_trends",
    q: topic,
    hl: "en",
    cat: category,
    date: timeframe,
    related_queries: true,
    data_type: "RELATED_QUERIES",
    api_key: apiKey,
  };

  if (geo) {
    apiParams.geo = geo;
  }

  try {
    console.log(
      "[googleTrendsClient] Fetching from SerpAPI with params:", apiParams
    );
    const resp = await axios.get(
      "https://serpapi.com/search.json", {params: apiParams}
    );
    const result = processSerpApiResponse(resp.data || {});

    cache[cacheKey] = {data: result, fetchedAt: Date.now()};
    console.log(`[googleTrendsClient] Cached result for ${cacheKey}`);

    return result;
  } catch (err: unknown) {
    console.warn(
      "[googleTrendsClient] Initial SerpAPI request failed. Retrying..."
    );

    apiParams.data_type = "RELATED_QUERIES";
    apiParams.date = "today 12-m";

    try {
      const resp = await axios.get(
        "https://serpapi.com/search.json", {params: apiParams}
      );
      const fallbackResult = processSerpApiResponse(resp.data || {});
      console.log("[googleTrendsClient] Fallback request succeeded.");
      return fallbackResult;
    } catch (fallbackErr: unknown) {
      if (cache[cacheKey]) {
        console.warn("[googleTrendsClient] Returning stale cached data.");
        return cache[cacheKey].data;
      }
      throw new Error(
        `Failed to fetch Google Trends for "${topic}": ` +
        `${(fallbackErr as Error).message}`
      );
    }
  }
}
