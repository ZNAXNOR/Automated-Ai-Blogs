import { ai } from '../clients/genkitInstance.client';
import { defineSecret } from 'firebase-functions/params';
import { r0_trends_input, r0_trends_output } from '../schemas/flows/r0_trends.schema';
import { fetchGoogleTrends } from '../clients/google/googleTrends.client';
import { normalizeTopicList } from '../utils/normalize.util';
import { sanitizeTopics } from '../utils/topicSanitizer.util';
import { BLOG_TOPICS } from '../clients/blogTopic.client';

import { v4 as uuidv4 } from 'uuid';

// --- Storage adapter import (r0 storage) ---
import { persistRoundOutput } from '../adapters/roundStorage.adapter';

const SERPAPI_KEY = defineSecret('SERPAPI_KEY');

console.log('[r0_trends]      Flow module loaded (multi-topic support, sanitized output)');

type Suggestion = { topic: string; score: number };

export const r0_trends = ai.defineFlow<typeof r0_trends_input, typeof r0_trends_output>(
  {
    name: 'Round0_Trends',
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

    let allSuggestions: Suggestion[] = [];
    let allTimelinePoints: { time: Date; value: number }[] = [];
    const results: {
      topic: string;
      suggestions: Suggestion[];
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

        // Filter per-topic suggestions under score 100
        const filteredSuggestions = result.suggestions.filter((s: Suggestion) => s.score >= 100);

        // Apply sanitization for API-safe topics
        const sanitizedSuggestions = sanitizeTopics(
          filteredSuggestions.map((s: Suggestion) => s.topic)
        );

        // Map back to scores
        const finalSuggestions = sanitizedSuggestions.map((topicStr) => ({
          topic: topicStr,
          score:
            filteredSuggestions.find(
              (s: Suggestion) => s.topic.toLowerCase() === topicStr.toLowerCase()
            )?.score ?? 0,
        }));

        results.push({
          topic: t,
          suggestions: finalSuggestions,
          trendTimeline: result.trendTimeline,
        });

        allSuggestions.push(...finalSuggestions);
        allTimelinePoints.push(...result.trendTimeline);
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
      .filter((s: Suggestion) => s.score >= 100) // filter again at aggregate level
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

    // --- Final output (unchanged) ---
    const output = {
      aggregatedTopics: topics,
      suggestions: normalizedSuggestions,
      trendTimeline: mergedTimeline,
      results, // per-topic results preserved
    };

    console.log('[r0_trends] Aggregated output prepared with sanitized topics.');

    const pipelineId = (input as any).pipelineId ?? uuidv4();
    let storageResult: any;

    try {
      storageResult = await ai.run('Round0_Storage', async () => {
        const args = { pipelineId, round: 'r0', data: output, inputMeta: input };
        const { pipelineId: pId, round = 'r0', data } = args;

        const startedAt = new Date().toISOString();
        try {
          const persistResult = await persistRoundOutput(pId, round, data);
          return {
            ok: true,
            pipelineId: pId,
            round,
            persistResult,
            startedAt,
            finishedAt: new Date().toISOString(),
          };
        } catch (err) {
          console.error(`[r0_trends:Round0_Storage] persistRoundOutput failed:`, err);
          return {
            ok: false,
            pipelineId: pId,
            round,
            error: String(err),
            startedAt,
            finishedAt: new Date().toISOString(),
          };
        }
      });
      console.log('[r0_trends] Round0_Storage span result:', storageResult);
    } catch (err) {
      console.error('[r0_trends] Round0_Storage span unexpected error:', err);
      storageResult = { ok: false, error: String(err) };
    }

    // Return the original output but include storage metadata for observability.
    // Existing consumers that expect the original shape will still receive it unchanged.
    return {
      ...output,
      // add pipelineId so downstream flows can reference it
      pipelineId,
      // storage metadata in a clearly namespaced field to avoid collisions
      __storage: storageResult,
    };
  }
);
