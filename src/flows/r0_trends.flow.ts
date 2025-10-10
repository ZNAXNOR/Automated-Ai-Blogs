import { ai } from '../clients/genkitInstance';
import { defineSecret } from 'firebase-functions/params';
import { r0_trends_input, r0_trends_output } from '../schemas/r0_trends.schema';
import { fetchGoogleTrends } from '../clients/googleTrendsClient';
import { normalizeTopicList } from '../utils/normalize';
import { BLOG_TOPICS } from '../clients/blogTopic';

const SERPAPI_KEY = defineSecret('SERPAPI_KEY');

console.log('[r0_trends]      Flow module loaded (multi-topic support, score filter ≥100)');

export const r0_trends = ai.defineFlow<typeof r0_trends_input, typeof r0_trends_output>(
  {
    name: 'r0_trends',
    inputSchema: r0_trends_input,
    outputSchema: r0_trends_output,
  },
  async (input) => {
    console.log('[r0_trends] Input received:', input);

    const apiKey = SERPAPI_KEY.value();
    if (!apiKey) throw new Error('[r0_trends] SERPAPI_KEY not defined.');

    const geo = input.geo ?? 'IN';
    const timeframe = input.timeframe ?? 'today 12-m';
    const category = input.category ?? 0;
    const topics = Array.isArray(input.topic)
      ? input.topic
      : input.topic
      ? [input.topic]
      : BLOG_TOPICS;

    console.log(`[r0_trends] Processing topics: ${topics.join(', ')}`);

    let allSuggestions: { topic: string; score: number }[] = [];
    let allTimelinePoints: { time: Date; value: number }[] = [];
    const results: {
      topic: string;
      suggestions: { topic: string; score: number }[];
      trendTimeline: { time: Date; value: number }[];
    }[] = [];

    // --- Fetch and collect per-topic results ---
    for (const t of topics) {
      try {
        console.log(`[r0_trends] Fetching data for topic "${t}"`);
        const result = await fetchGoogleTrends({
          topic: t,
          geo,
          timeframe,
          category,
          apiKey,
        });

        // 🧹 Filter per-topic suggestions under score 100
        const filteredSuggestions = result.suggestions.filter((s: { topic: string; score: number }) => s.score >= 100);

        results.push({
          topic: t,
          suggestions: filteredSuggestions,
          trendTimeline: result.trendTimeline,
        });

        allSuggestions.push(...filteredSuggestions);
        allTimelinePoints.push(...result.trendTimeline);

        console.log(`[r0_trends] Completed: ${t}, kept ${filteredSuggestions.length}/${result.suggestions.length} suggestions`);
      } catch (err) {
        console.error(`[r0_trends] Error fetching topic "${t}":`, err);
      }
    }

    // --- Aggregate & normalize across all topics ---
    const aggregatedMap = new Map<string, { total: number; count: number }>();
    for (const s of allSuggestions) {
      const key = s.topic.toLowerCase();
      const entry = aggregatedMap.get(key) || { total: 0, count: 0 };
      entry.total += s.score;
      entry.count++;
      aggregatedMap.set(key, entry);
    }

    const aggregatedSuggestions = Array.from(aggregatedMap.entries())
      .map(([topic, v]) => ({
        topic,
        score: Math.round(v.total / v.count),
      }))
      .filter((s: { topic: string; score: number }) => s.score >= 100) // 🧹 filter again at aggregate level
      .sort((a, b) => b.score - a.score);

    const normalizedSuggestions = normalizeTopicList(aggregatedSuggestions);

    // --- Merge timeline values by time ---
    const timelineMap = new Map<number, number[]>();
    for (const pt of allTimelinePoints) {
      const ts = new Date(pt.time).getTime();
      if (!timelineMap.has(ts)) timelineMap.set(ts, []);
      timelineMap.get(ts)?.push(pt.value);
    }

    const mergedTimeline = Array.from(timelineMap.entries()).map(([ts, vals]) => ({
      time: new Date(ts),
      value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }));

    // --- Final output ---
    const output = {
      aggregatedTopics: topics,
      suggestions: normalizedSuggestions,
      trendTimeline: mergedTimeline,
      results, // per-topic results preserved
    };

    console.log('[r0_trends] Aggregated output prepared with score filtering.');
    return output;
  }
);