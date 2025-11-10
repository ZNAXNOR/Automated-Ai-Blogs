/**
 * @file Fetches, analyzes, and aggregates Google Trends data to identify high-potential topics.
 * @author Omkar Dalvi
 *
 * This flow performs the first step in the content pipeline (Round 0) by:
 * 1. Fetching Google Trends suggestions for a given list of topics.
 * 2. Filtering out topics that have already been used, based on a Firestore collection.
 * 3. Storing new, high-potential topics back to Firestore for future reference.
 * 4. Aggregating and normalizing scores for all suggestions to create a ranked list.
 * 5. Persisting the final output to a storage bucket for subsequent pipeline steps.
 */

import { ai } from '../../clients/genkitInstance.client.js';
import { defineSecret } from 'firebase-functions/params';
import { r0_trends_input, r0_trends_output } from '../../schemas/flows/r0_trends.schema.js';
import { fetchGoogleTrends } from '../../clients/google/googleTrends.client.js';
import { normalizeTopicList } from '../../utils/normalize.util.js';
import { sanitizeTopics } from '../../utils/topicSanitizer.util.js';
import { BLOG_TOPICS } from '../../clients/blogTopic.client.js';
import { getDb } from '../../clients/firebase/firestore.client.js';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { round0StorageStep } from './r0_storage.step.js';

// Define the SERPAPI_KEY as a secret to be accessed securely at runtime.
const SERPAPI_KEY = defineSecret('SERPAPI_KEY');

console.log('[r0_trends] Flow module loaded');

type Suggestion = { topic: string; score: number };

/**
 * Retrieves a set of topic strings that have already been processed from Firestore.
 * This prevents the pipeline from generating content on the same topic repeatedly.
 * @returns A promise that resolves to a Set of lowercase topic strings.
 */
async function getUsedTopics(): Promise<Set<string>> {
  const db = getDb();
  const usedTopicsCollection = collection(db, 'usedTopics');
  const snapshot = await getDocs(usedTopicsCollection);
  const topics = new Set<string>();
  snapshot.forEach((doc) => topics.add(doc.id.toLowerCase()));
  console.log(`[r0_trends] Fetched ${topics.size} used topics from Firestore.`);
  return topics;
}

/**
 * Stores a list of new, unused topic suggestions in Firestore, organized by category and date.
 * This builds a historical record of potential topics.
 * @param category The parent topic or category for the suggestions.
 * @param topics The array of new suggestions to store.
 */
async function storeNewTopics(category: string, topics: Suggestion[]) {
  if (topics.length === 0) {
    return;
  }
  const db = getDb();
  const now = new Date();
  const year = `${now.getFullYear()}`;
  const month = `${year}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const docRef = doc(db, 'topics', category, year, month);

  // Sort topics by score in descending order before storing.
  const sortedTopics = [...topics].sort((a, b) => b.score - a.score);

  await setDoc(docRef, { topics: sortedTopics }, { merge: true });
  console.log(`[r0_trends] Stored ${sortedTopics.length} new topics for category "${category}".`);
}

/**
 * The main flow for Round 0, responsible for trend analysis and topic discovery.
 */
export const r0_trends = ai.defineFlow(
  {
    name: 'Round0_Trends',
    inputSchema: r0_trends_input,
    outputSchema: r0_trends_output,
  },
  async (input) => {
    console.log('[r0_trends] Starting flow with input:', input);
    const pipelineId = (input as any).pipelineId;
    if (!pipelineId) {
      throw new Error('[r0_trends] A pipelineId must be provided.');
    }

    // Fetch topics that have been used previously to avoid duplication.
    const usedTopics = await getUsedTopics();
    const apiKey = SERPAPI_KEY.value();
    if (!apiKey) throw new Error('[r0_trends] SERPAPI_KEY is not configured.');

    // Determine the list of seed topics to analyze.
    const seedTopics = input.topic && input.topic.length > 0 ? input.topic : BLOG_TOPICS;
    const geo = input.geo ?? 'IN';
    const timeframe = (input as any).timeframe ?? 'today 12-m';

    const allSuggestions: Suggestion[] = [];
    const allTimelinePoints: { time: Date; value: number }[] = [];
    const results: any[] = [];

    // Iterate through each seed topic to fetch and process its trend data.
    for (const topic of Array.isArray(seedTopics) ? seedTopics : [seedTopics]) {
      try {
        console.log(`[r0_trends] Fetching trends for topic: "${topic}"`);
        const trendData = await fetchGoogleTrends({ topic, geo, apiKey, timeframe });

        // Filter for high-scoring and new (unused) suggestions.
        const highScoringSuggestions = trendData.suggestions.filter((s: Suggestion) => s.score >= 100);
        const sanitizedTopics = sanitizeTopics(highScoringSuggestions.map((s: Suggestion) => s.topic));
        
        const newSuggestions = sanitizedTopics
          .map((topicStr) => ({
            topic: topicStr,
            score: highScoringSuggestions.find((s: Suggestion) => s.topic.toLowerCase() === topicStr.toLowerCase())?.score ?? 0,
          }))
          .filter((s: Suggestion) => !usedTopics.has(s.topic.toLowerCase()));

        // Store the newly discovered topics for future reference.
        await storeNewTopics(topic, newSuggestions);

        results.push({
          topic,
          suggestions: newSuggestions,
          trendTimeline: trendData.trendTimeline,
        });

        allSuggestions.push(...newSuggestions);
        allTimelinePoints.push(...trendData.trendTimeline);

      } catch (err) {
        console.error(`[r0_trends] Failed to fetch or process topic "${topic}":`, err);
      }
    }

    // Aggregate results from all topics to create a single, unified list.
    const aggregatedMap = new Map<string, { total: number; count: number }>();
    allSuggestions.forEach((s) => {
      const key = s.topic.toLowerCase();
      const entry = aggregatedMap.get(key) || { total: 0, count: 0 };
      entry.total += s.score;
      entry.count++;
      aggregatedMap.set(key, entry);
    });

    // Average the scores for topics that appeared in multiple trend analyses.
    const averagedSuggestions = Array.from(aggregatedMap.entries()).map(([topic, v]) => ({
      topic,
      score: Math.round(v.total / v.count),
    }));

    // Normalize scores to a standard scale (e.g., 0-100).
    const normalizedSuggestions = normalizeTopicList(averagedSuggestions);
    
    // Merge timeline data from all topics into a single, averaged timeline.
    const timelineMap = new Map<number, number[]>();
    allTimelinePoints.forEach(pt => {
        const ts = new Date(pt.time).getTime();
        if (!timelineMap.has(ts)) timelineMap.set(ts, []);
        timelineMap.get(ts)!.push(pt.value);
    });
    const mergedTimeline = Array.from(timelineMap.entries()).map(([ts, vals]) => ({
        time: new Date(ts),
        value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }));

    // Prepare the final output object.
    const output: z.infer<typeof r0_trends_output> = {
      aggregatedTopics: Array.isArray(seedTopics) ? seedTopics : [seedTopics],
      suggestions: normalizedSuggestions,
      trendTimeline: mergedTimeline,
      results,
    };
    
    console.log(`[r0_trends] Aggregated ${normalizedSuggestions.length} unique, normalized suggestions.`);

    // Persist the output of this round to storage for subsequent flows.
    const storageResult = await round0StorageStep(pipelineId, output);

    return { ...output, pipelineId, __storage: storageResult };
  }
);
