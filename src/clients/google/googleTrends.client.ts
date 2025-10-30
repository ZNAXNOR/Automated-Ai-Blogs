import axios from 'axios';
import { normalizeTopicList } from '../../utils/normalize.util';

interface GoogleTrendsParams {
  topic: string;
  geo?: string;
  timeframe: string;
  category?: number;
  apiKey: string;
}

interface CacheEntry {
  data: any;
  fetchedAt: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 5; // 5 days

function processSerpApiResponse(data: any) {
    // ✅ Extract *all* related queries (rising + top)
    const rising = Array.isArray(data.related_queries?.rising)
      ? data.related_queries.rising
      : [];
    const top = Array.isArray(data.related_queries?.top)
      ? data.related_queries.top
      : [];

    const related = [...rising, ...top];

    const suggestions = related.map((rq: any) => ({
      topic: rq.query ?? 'unknown',
      score: parseFloat(rq.extracted_value ?? rq.value ?? 0) || 0,
    }));

    // ✅ Extract full timeline
    const timeline = (data.interest_over_time?.timeline_data ?? []).map((pt: any) => {
      const v = pt.values?.[0];
      const num = parseFloat(v?.extracted_value ?? v?.value ?? 0) || 0;
      return { time: new Date(pt.date), value: num };
    });

    const cleanSuggestions = normalizeTopicList(suggestions);

    return {
      suggestions: cleanSuggestions,
      trendTimeline: timeline,
    };
}


export async function fetchGoogleTrends(params: GoogleTrendsParams) {
  const { topic, geo, timeframe, category = 0, apiKey } = params;
  const cacheKey = `${topic}_${geo}_${timeframe}_${category}`.toLowerCase().replace(/\s+/g, '_');

  // 1️⃣ Cache check
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    console.log(`[googleTrendsClient] Using cached data for ${cacheKey}`);
    return cached.data;
  }

  let apiParams: any = {
    engine: 'google_trends',
    q: topic,
    hl: 'en',
    geo,
    cat: category,
    date: timeframe,
    related_queries: true,
    data_type: 'RELATED_QUERIES',
    api_key: apiKey,
  };

  try {
    console.log(`[googleTrendsClient] Fetching from SerpAPI with params:`, apiParams);
    const resp = await axios.get('https://serpapi.com/search.json', { params: apiParams });
    const result = processSerpApiResponse(resp.data || {});

    cache[cacheKey] = { data: result, fetchedAt: Date.now() };
    console.log(`[googleTrendsClient] Cached result for ${cacheKey}`);

    return result;
  } catch (err: any) {
    console.warn('[googleTrendsClient] Initial SerpAPI request failed. Retrying with fallback...');
    
    apiParams.data_type = 'RELATED_QUERIES';
    apiParams.date = 'today 12-m';

    try {        
        const resp = await axios.get('https://serpapi.com/search.json', { params: apiParams });        
        const fallbackResult = processSerpApiResponse(resp.data || {});
        console.log('[googleTrendsClient] Fallback request succeeded.');
        return fallbackResult;
    } catch (fallbackErr: any) {        
        if (cache[cacheKey]) {
          console.warn('[googleTrendsClient] Returning stale cached data.');
          return cache[cacheKey].data;
        }
        throw new Error(`Failed to fetch Google Trends for "${topic}": ${fallbackErr.message}`);
    }
  }
}
