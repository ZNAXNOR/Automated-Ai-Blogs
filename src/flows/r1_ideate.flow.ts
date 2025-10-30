import { ai } from '../clients/genkitInstance.client';
import { r1_ideate_input, r1_ideate_output } from '../schemas/flows/r1_ideate.schema';
import { safeParseJsonFromAI } from '../clients/aiParsing.client';
import admin from 'firebase-admin';
import { fetchNewsForTopics } from '../clients/google/googleNews.client';
import { googleSearchTool } from '../tools/googleSearch.tool'; // conditional tool

console.log('[r1_ideate]      Flow module loaded');

// ---------- Firestore init ----------
if (!admin.apps.length) admin.initializeApp();
const firestore = admin.firestore();

// ---------- Optional artifact saver ----------
let saveArtifact: ((key: string, value: any) => Promise<void>) | undefined;
try {
  const artifacts = require('../lib/artifacts');
  saveArtifact = artifacts?.saveArtifact;
} catch {}

// ---------- Helper: pick best topic list ----------
function pickTopicArray(input: any): string[] | null {
  if (input.results && input.results.length > 0) {
    const sorted = [...input.results].sort((a, b) => {
      const sum = (arr: any[]) => arr.reduce((s, x) => s + (x.score || 0), 0);
      return sum(b.suggestions || []) - sum(a.suggestions || []);
    });
    const chosen = sorted.find((r) => r.suggestions && r.suggestions.length > 0);
    if (chosen) return chosen.suggestions.map((s: any) => s.topic);
  }
  if (input.aggregatedTopics?.length) return input.aggregatedTopics;
  if (input.topic) return [input.topic];
  if (input.seedPrompt) return [input.seedPrompt];
  return null;
}

// ---------- Main flow ----------
export const r1_ideate = ai.defineFlow(
  {
    name: 'Round1_Ideation',
    inputSchema: r1_ideate_input,
    outputSchema: r1_ideate_output,
  },
  async (input) => {
    console.log('[r1_ideate] Flow invoked with input:', input);
    const parsedInput = r1_ideate_input.parse(input);

    const topicArray = pickTopicArray(parsedInput);
    if (!topicArray?.length) throw new Error('No usable topic array found in input.');

    // 1️⃣ Fetch related news
    let headlines = await fetchNewsForTopics(topicArray);

    // 2️⃣ Decide whether to use search tool as a fallback.
    const useSearchTool = !headlines?.length || headlines.length < 3;
    if (useSearchTool) {
      console.log('[r1_ideate] Using GoogleSearchTool fallback...');
    }

    const newsSummary = headlines.length
      ? `Here are some recent headlines:\n${headlines.map((h) => `- ${h}`).join('\n')}`
      : 'No related live news found; rely purely on trend input.';

    // 3️⃣ Call prompt, dynamically providing tools if needed.
    const promptFn = ai.prompt(
      useSearchTool ? 'Round1_IdeationPrompt_With_Search' : 'Round1_IdeationPrompt'
    );
    let resp;
    try {
      resp = await promptFn(
        { // Prompt Input
          trendInput: topicArray.join(', '),
          recentNews: newsSummary,
        },
        { // Options
          tools: useSearchTool ? [googleSearchTool] : [],
        }
      );
    } catch (err) {
      console.error('[r1_ideate] Prompt call failed:', err);
      throw new Error('Prompt execution error in r1_ideate');
    }

    // 4️⃣ Parse model output
    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) throw new Error('Prompt returned no usable result');

    let ideationObj;
    try {
      ideationObj = safeParseJsonFromAI(raw);
    } catch (err) {
      console.error('[r1_ideate] JSON parse failed', { raw, err });
      throw new Error('Failed to parse prompt output');
    }

    // Add timestamp
    ideationObj.timestamp = new Date().toISOString();

    // 🔹 Normalize references before saving
    if (ideationObj.references?.length) {
      const seen = new Set();
      ideationObj.references = ideationObj.references.filter((r: any) => {
        if (!r?.url || seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
    }

    // 5️⃣ Validate schema
    r1_ideate_output.parse(ideationObj);

    // 6️⃣ Persist to Firestore
    try {
      await firestore.collection('r1_ideate_results').add({
        ...ideationObj,
        topicsUsed: topicArray,
        headlines,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        rawModelOutput: raw,
        references: ideationObj.references || [],
      });
    } catch (err) {
      console.warn('r1_ideate: failed to persist to Firestore', err);
    }

    // 7️⃣ Optional artifact
    if (saveArtifact) {
      try {
        await saveArtifact('artifacts.round1', ideationObj);
      } catch (err) {
        console.warn('r1_ideate: failed to save artifact', err);
      }
    }

    console.log('[r1_ideate] ✅ Success:', ideationObj.title);
    return ideationObj;
  }
);
