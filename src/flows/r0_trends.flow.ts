import { ai } from '../clients/genkitInstance.client';
import { defineSecret } from 'firebase-functions/params';
import { r0_trends_input, r0_trends_output } from '../schemas/flows/r0_trends.schema';
import { fetchGoogleTrends } from '../clients/google/googleTrends.client';
import { normalizeTopicList } from '../utils/normalize.util';
import { sanitizeTopics } from '../utils/topicSanitizer.util';
import { BLOG_TOPICS } from '../clients/blogTopic.client';
import { v4 as uuidv4 } from 'uuid';
import { persistRoundOutput } from '../adapters/roundStorage.adapter';
// Import Firestore client and modular functions
import { db } from '../clients/firebase/firestore.client';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

const SERPAPI_KEY = defineSecret('SERPAPI_KEY');

console.log('[r0_trends]      Flow module loaded');

type Suggestion = { topic: string; score: number };

// Helper to get used topics from Firestore
async function getUsedTopics(): Promise<Set<string>> {
  const usedTopicsCollection = collection(db, 'usedTopics');
  const snapshot = await getDocs(usedTopicsCollection);
  const topics = new Set<string>();
  snapshot.forEach((doc : any) => {
    topics.add(doc.id);
  });
  console.log(`[r0_trends] Fetched ${topics.size} used topics from Firestore.`);
  return topics;
}

// Helper to store new topics in Firestore
async function storeNewTopics(category: string, topics: Suggestion[]) {
  if (topics.length === 0) {
    console.log(`[r0_trends] No new topics to store for category: ${category}`);
    return;
  }

  const now = new Date();  
  const year = `${now.getFullYear()}`;
  const month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const docRef = doc(db, 'topics', category, year, month);

  // Sort topics by score in ascending order
  const sortedTopics = [...topics].sort((a, b) => a.score - b.score);

  await setDoc(docRef, { topics: sortedTopics }, { merge: true });
  console.log(`[r0_trends] Stored ${sortedTopics.length} new topics for category "${category}" in month "${month}".`);
}

export const r0_trends = ai.defineFlow<typeof r0_trends_input, typeof r0_trends_output>(
  {
    name: 'Round0_Trends',
    inputSchema: r0_trends_input,
    outputSchema: r0_trends_output,
  },
  async (input) => {
    console.log('[r0_trends] Input received:', input);

    const pipelineId = (input as any).pipelineId;
    if (!pipelineId) {
      throw new Error('[r0_trends] A pipelineId must be provided as input.');
    }

    // Fetch used topics from Firestore
    const usedTopics = await getUsedTopics();

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
        const sanitizedSuggestionTopics = sanitizeTopics(
          filteredSuggestions.map((s: Suggestion) => s.topic)
        );

        // Map back to scores
        const finalSuggestionsWithScores = sanitizedSuggestionTopics.map((topicStr) => ({
          topic: topicStr,
          score:
            filteredSuggestions.find(
              (s: Suggestion) => s.topic.toLowerCase() === topicStr.toLowerCase()
            )?.score ?? 0,
        }));
        
        // Filter out already used topics
        const newSuggestions = finalSuggestionsWithScores.filter(s => !usedTopics.has(s.topic.toLowerCase()));

        // Store new topics in Firestore for the current category
        await storeNewTopics(t, newSuggestions);

        results.push({
          topic: t,
          suggestions: newSuggestions, // Use the new, filtered suggestions
          trendTimeline: result.trendTimeline,
        });

        allSuggestions.push(...newSuggestions); // Aggregate only new suggestions
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
      .filter((s: Suggestion) => s.score >= 100)
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
      results,
    };

    console.log('[r0_trends] Aggregated output prepared with sanitized topics.');

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

    return {
      ...output,
      pipelineId,
      __storage: storageResult,
    };
  }
);
