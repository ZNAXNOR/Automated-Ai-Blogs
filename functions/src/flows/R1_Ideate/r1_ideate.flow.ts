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

import {ai} from "../../clients/genkitInstance.client";
import {r1IdeateInput, r1IdeateOutput} from "../../schemas/flows/r1_ideate.schema";
import {safeParseJsonFromAI} from "../../clients/aiParsing.client";
import {fetchNewsForTopics} from "../../clients/google/googleNews.client";
import {googleSearchTool} from "../../tools/googleSearch.tool";
import {db} from "../../clients/firebase/firestore.client";
import {doc, setDoc} from "firebase/firestore";
import {round1StorageStep} from "./r1_storage.step";

console.log("[r1Ideate] Flow module loaded");

/**
 * Marks a topic as used in Firestore to avoid generating content on it again.
 * @param topic The topic string to mark as used.
 * @param pipelineId The ID of the pipeline run that is using this topic.
 */
async function storeUsedTopic(topic: string, pipelineId: string) {
  if (!topic) return;
  const docRef = doc(db, "usedTopics", topic.toLowerCase());
  // Store the topic with a timestamp and the pipeline ID for traceability.
  await setDoc(docRef, {
    usedAt: new Date().toISOString(),
    pipelineId,
  }, {merge: true});
  console.log(`[r1Ideate] Marked topic "${topic}" as used in Firestore.`);
}

/**
 * Selects the most promising list of topics from the R0 output.
 * It prioritizes the refined `suggestions` list but falls back to the original `aggregatedTopics`.
 * @param input The input from the r0_trends flow.
 * @return An array of topic strings, or null if none are found.
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
export const r1Ideate = ai.defineFlow(
  {
    name: "round1Ideation",
    inputSchema: r1IdeateInput,
    outputSchema: r1IdeateOutput,
  },
  async (input) => {
    console.log("[r1Ideate] Starting flow with input:", input);
    const parsedInput = r1IdeateInput.parse(input);

    const topicArray = pickTopicArray(parsedInput);
    if (!topicArray || topicArray.length === 0) {
      throw new Error("[r1Ideate] No usable topic array found in the input.");
    }

    const mainTopic = topicArray[0];
    const {pipelineId} = parsedInput;
    if (typeof mainTopic !== "string" || !mainTopic) {
      throw new Error("[r1Ideate] Invalid main topic.");
    }

    await storeUsedTopic(mainTopic, pipelineId);

    const headlines = await fetchNewsForTopics(topicArray);
    const newsSummary = headlines.length ?
      `Recent headlines for context:\n${headlines.map((h) => `- ${h}`).join("\n")}` :
      "No recent news found; relying on general knowledge.";

    const useSearchTool = headlines.length < 3;
    if (useSearchTool) {
      console.log("[r1Ideate] News context is sparse. Enabling GoogleSearchTool as a fallback.");
    }

    const promptFn = ai.prompt(
      useSearchTool ? "round1IdeationPromptWithSearch" : "round1IdeationPrompt"
    );

    const resp = await promptFn(
      {
        trendInput: topicArray.join(", "),
        recentNews: newsSummary,
      },
      {tools: useSearchTool ? [googleSearchTool] : []}
    );

    const rawOutput = resp.text ?? JSON.stringify(resp.output);
    if (!rawOutput) {
      throw new Error("[r1Ideate] AI prompt returned no usable output.");
    }

    let ideationObj;
    try {
      ideationObj = safeParseJsonFromAI(rawOutput);
    } catch (err) {
      console.error("[r1Ideate] JSON parse failed", {raw: rawOutput, err});
      throw new Error("Failed to parse prompt output");
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

    const parsedIdeationObj = r1IdeateOutput.parse(ideationObj);

    console.log(`[r1Ideate] Generated idea: "${parsedIdeationObj.title}"`);

    const storageResult = await round1StorageStep(pipelineId, parsedIdeationObj, parsedInput);

    const finalOutput = {
      ...parsedIdeationObj,
      __storage: storageResult,
    };

    console.log("[r1Ideate] ✅ Completed successfully:", {
      pipelineId,
      ideaTitle: finalOutput.title,
      gcsPath: storageResult?.persistResult?.gcsPath,
    });

    return finalOutput;
  }
);
