import { ai } from '../clients/genkitInstance';
import axios from 'axios';
import { defineSecret } from 'firebase-functions/params';
import { r0_trends_input, r0_trends_output } from '../schemas/r0_trends.schema';

const SERPAPI_KEY = defineSecret('SERPAPI_KEY');

export const r0_trends = ai.defineFlow(
  {
    name: 'r0_trends',
    inputSchema: r0_trends_input,
    outputSchema: r0_trends_output,
  },
  async (input) => {
    const apiKey = SERPAPI_KEY.value();
    if (!apiKey) {
      throw new Error(
        'SERPAPI_KEY secret is not defined or accessible.'
      );
    }

    const resp = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_trends',
        q: input.topic,
        geo: input.geo ?? 'IN',
        timeframe: input.timeframe ?? 'now 7-d',
        api_key: apiKey,
        // we request related queries also
        data_type: 'RELATED_QUERIES',
      },
    });

    const data = resp.data;

    const related = data.related_queries?.rising ?? [];

    // Build blog topic suggestions from related queries
    const suggestions = related
      .slice(0, input.relatedLimit ?? 5)
      .map((rq: any) => ({
        topic: rq.query,                             // the related query string
        score: (() => {
          if (typeof rq.extracted_value === 'number') {
            return rq.extracted_value;
          } else if (typeof rq.value === 'number') {
            return rq.value;
          } else if (typeof rq.value === 'string') {
            return Number(rq.value) || 0;
          } else {
            return 0;
          }
        })(),
      }));

    // Optionally also return the timeline / metrics so downstream can see trend strength
    const timeline = (data.interest_over_time?.timeline_data ?? []).map((pt: any) => {
      const first = pt.values?.[0];
      let numValue: number = 0;
      if (first) {
        if (typeof first.extracted_value === 'number') {
          numValue = first.extracted_value;
        } else if (typeof first.value === 'number') {
          numValue = first.value;
        } else if (typeof first.value === 'string') {
          numValue = Number(first.value) || 0;
        }
      }
      return {
        time: pt.date,
        value: numValue,
      };
    });

    return {
      baseTopic: input.topic,
      suggestions,
      trendTimeline: timeline,
    };
  }
);

console.log('Loading r0_trends flow definition');
