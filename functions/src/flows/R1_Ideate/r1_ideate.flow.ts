/**
 * @file Generates concrete blog post ideas based on trend data from the previous round.
 * @author Omkar Dalvi
 *
 * This flow (Round 1) takes the keyword suggestions from R0 and transforms them into a viable
 * blog post title and concept. It performs the following steps:
 * 1. Selects the most promising topic from the input.
 * 2. Marks the selected topic as "used" in Firestore to prevent duplicate content.
 * 3. Fetches recent news headlines related to the topics to provide current context.
 * 4. Uses a generative AI prompt (with an optional search tool fallback) to brainstorm a title and angle.
 * 5. Parses and validates the AI-generated idea.
 * 6. Persists the final idea to a storage bucket for the next pipeline step.
 */

import { ai } from '../../clients/genkitInstance.client.js';
import { r1_ideate_input, r1_ideate_output } from '../../schemas/flows/r1_ideate.schema.js';
import { safeParseJsonFromAI } from '../../clients/aiParsing.client.js';
import { fetchNewsForTopics } from '../../clients/google/googleNews.client.js';
import { googleSearchTool } from '../../tools/googleSearch.tool.js';
import { getDb } from '../../clients/firebase/firestore.client.js';
import { doc, setDoc } from 'firebase/firestore';
import { round1StorageStep } from './r1_storage.step.js';

console.log('[r1_ideate] Flow module loaded');

/**
 * Marks a topic as used in Firestore to avoid generating content on it again.
 * @param topic The topic string to mark as used.
 * @param pipelineId The ID of the pipeline run that is using this topic.
 */
async function storeUsedTopic(topic: string, pipelineId: string) {
  if (!topic) return;
  const db = getDb();
  const docRef = doc(db, 'usedTopics', topic.toLowerCase());
  // Store the topic with a timestamp and the pipeline ID for traceability.
  await setDoc(docRef, { 
    usedAt: new Date().toISOString(),
    pipelineId,
  }, { merge: true });
  console.log(`[r1_ideate] Marked topic "${topic}" as used in Firestore.`);
}

/**
 * Selects the most promising list of topics from the R0 output.
 * It prioritizes the refined `suggestions` list but falls back to the original `aggregatedTopics`.
 * @param input The input from the r0_trends flow.
 * @returns An array of topic strings, or null if none are found.
 */
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


/**
 * The main flow for Round 1, responsible for generating a concrete blog post idea.
 */
export const r1_ideate = ai.defineFlow(
  {
    name: 'Round1_Ideation',
    inputSchema: r1_ideate_input,
    outputSchema: r1_ideate_output,
  },
  async (input) => {
    console.log('[r1_ideate] Starting flow with input:', input);
    const parsedInput = r1_ideate_input.parse(input);

    const topicArray = pickTopicArray(parsedInput);
    if (!topicArray || topicArray.length === 0) {
      throw new Error('[r1_ideate] No usable topic array found in the input.');
    }

    const mainTopic = topicArray[0];
    const { pipelineId } = parsedInput;
    if (typeof mainTopic !== 'string' || !mainTopic) {
        throw new Error('[r1_ideate] Invalid main topic.');
    }

    await storeUsedTopic(mainTopic, pipelineId);

    const headlines = await fetchNewsForTopics(topicArray);
    const newsSummary = headlines.length
      ? `Recent headlines for context:\n${headlines.map((h) => `- ${h}`).join('\n')}`
      : 'No recent news found; relying on general knowledge.';

    const useSearchTool = headlines.length < 3;
    if (useSearchTool) {
      console.log('[r1_ideate] News context is sparse. Enabling GoogleSearchTool as a fallback.');
    }

    const promptFn = ai.prompt(
      useSearchTool ? 'Round1_IdeationPrompt_With_Search' : 'Round1_IdeationPrompt'
    );

    const resp = await promptFn(
      {
        trendInput: topicArray.join(', '),
        recentNews: newsSummary,
      },
      { tools: useSearchTool ? [googleSearchTool] : [] }
    );

    const rawOutput = resp.text ?? JSON.stringify(resp.output);
    if (!rawOutput) {
      throw new Error('[r1_ideate] AI prompt returned no usable output.');
    }

    let ideationObj;
    try {
      ideationObj = safeParseJsonFromAI(rawOutput);
    } catch (err) {
      console.error('[r1_ideate] JSON parse failed', { raw: rawOutput, err });
      throw new Error('Failed to parse prompt output');
    }
    
    ideationObj.pipelineId = pipelineId;
    ideationObj.topic = mainTopic;
    ideationObj.createdAt = new Date().toISOString();

    if (ideationObj.references?.length) {
      const seen = new Set();
      ideationObj.references = ideationObj.references.filter((r: any) => {
        if (!r?.url || seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
    }

    const parsedIdeationObj = r1_ideate_output.parse(ideationObj);

    console.log(`[r1_ideate] Generated idea: "${parsedIdeationObj.title}"`);

    const storageResult = await round1StorageStep(pipelineId, parsedIdeationObj, parsedInput);
  
      const finalOutput = {
        ...parsedIdeationObj,
        __storage: storageResult,
      };
  
      console.log('[r1_ideate] ✅ Completed successfully:', {
        pipelineId,
        ideaTitle: finalOutput.title,
        gcsPath: storageResult?.persistResult?.gcsPath,
      });
  
      return finalOutput;
  }
);
