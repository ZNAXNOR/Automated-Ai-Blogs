import { ai } from '../clients/genkitInstance';
import axios from 'axios';
import { defineSecret } from 'firebase-functions/params';
import { r0_trends_input, r0_trends_output } from '../schemas/r0_trends.schema';

const SERPAPI_KEY = defineSecret('SERPAPI_KEY');

console.log('Loading r0_trends flow definition');

export const r0_trends = ai.defineFlow<
  typeof r0_trends_input,
  typeof r0_trends_output
>(
  {
    name: 'r0_trends',
    inputSchema: r0_trends_input,
    outputSchema: r0_trends_output,
  },
  async (input) => {
    console.log('[r0_trends] Input received:', input);

    const apiKey = SERPAPI_KEY.value();
    if (!apiKey) {
      throw new Error('[r0_trends] SERPAPI_KEY secret not defined or accessible.');
    }

    // Default parameters
    const topic = input.topic;
    const geo = input.geo ?? 'IN';
    const timeframe = input.timeframe ?? 'now 7-d';
    const relatedLimit = input.relatedLimit ?? 5;

    console.log('[r0_trends] Fetching Google Trends for topic:', topic, 'geo:', geo, 'timeframe:', timeframe);

    const resp = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_trends',
        q: topic,
        geo,
        timeframe,
        api_key: apiKey,
        data_type: 'RELATED_QUERIES',
      },
    });

    const data = resp.data;

    // Parse related queries safely
    const related = Array.isArray(data.related_queries?.rising)
      ? data.related_queries.rising
      : [];

    const suggestions = related.slice(0, relatedLimit).map((rq: any) => ({
      topic: rq.query ?? 'unknown',
      score: (() => {
        if (typeof rq.extracted_value === 'number') return rq.extracted_value;
        if (typeof rq.value === 'number') return rq.value;
        if (typeof rq.value === 'string') return Number(rq.value) || 0;
        return 0;
      })(),
    }));

    // Parse trend timeline safely
    const timeline = (data.interest_over_time?.timeline_data ?? []).map((pt: any) => {
      const first = pt.values?.[0];
      let numValue = 0;
      if (first) {
        if (typeof first.extracted_value === 'number') numValue = first.extracted_value;
        else if (typeof first.value === 'number') numValue = first.value;
        else if (typeof first.value === 'string') numValue = Number(first.value) || 0;
      }
      return { time: new Date(pt.date), value: numValue };
    });

    console.log('[r0_trends] Suggestions found:', suggestions.map((s: { topic: string }) => s.topic));
    console.log('[r0_trends] Timeline points:', timeline.length);

    // Return in the correct schema
    const output = {
      baseTopic: topic,
      suggestions,
      trendTimeline: timeline,
    };

    console.log('[r0_trends] Output object prepared:', output);

    return output;
  }
);
