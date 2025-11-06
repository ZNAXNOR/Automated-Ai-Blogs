/**
 * @file Generates concrete blog post ideas based on trend data from the
 * previous round.
 * @author Omkar Dalvi
 *
 * This flow (Round 1) takes the keyword suggestions from R0 and transforms them
 * into a viable blog post title and concept. It performs the following steps:
 * 1. Selects the most promising topic from the input.
 * 2. Marks the selected topic as "used" in Firestore to prevent duplicate
 *    content.
 * 3. Fetches recent news headlines related to the topics to provide current
 *    context.
 * 4. Uses a generative AI prompt (with an optional search tool fallback) to
 *    brainstorm a title and angle.
 * 5. Parses and validates the AI-generated idea.
 * 6. Persists the final idea to a storage bucket for the next pipeline step.
 */

import {z} from "zod";
import {ai} from "../../clients/genkitInstance.client.js";
import {
  r1IdeateInput,
  r1IdeateOutput,
  referenceSchema,
} from "../../schemas/flows/r1_ideate.schema.js";
import {safeParseJsonFromAI} from "../../clients/aiParsing.client.js";
import {fetchNewsForTopics} from "../../clients/google/googleNews.client.js";
import {googleSearchTool} from "../../tools/googleSearch.tool.js";
import {db} from "../../clients/firebase/firestore.client.js";
import {doc, setDoc} from "firebase/firestore";
import {round1StorageStep} from "./r1_storage.step.js";
import {r0TrendsOutput} from "../../schemas/flows/r0_trends.schema.js";

console.log("[r1Ideate] Flow module loaded");

/**
 * Marks a topic as used in Firestore to avoid generating content on it again.
 * @param {string} topic The topic string to mark as used.
 * @param {string} pipelineId The ID of the pipeline run that is using this
 *   topic.
 */
async function storeUsedTopic(topic: string, pipelineId: string) {
  if (!topic) return;
  const docRef = doc(db, "usedTopics", topic.toLowerCase());
  // Store the topic with a timestamp and the pipeline ID for traceability.
  await setDoc(
    docRef,
    {
      usedAt: new Date().toISOString(),
      pipelineId,
    },
    {merge: true}
  );
  console.log(`[r1Ideate] Marked topic "${topic}" as used in Firestore.`);
}

function pickTopicArray(
  input: z.infer<typeof r0TrendsOutput>
): string[] | null {
  if (input.results && input.results.length > 0) {
    const sorted = [...input.results].sort((a, b) => {
      const sum = (arr: {score?: number}[]) =>
        arr.reduce((s, x) => s + (x.score || 0), 0);
      return sum(b.suggestions || []) - sum(a.suggestions || []);
    });
    const chosen = sorted.find(
      (r) => r.suggestions && r.suggestions.length > 0
    );
    if (chosen) return chosen.suggestions.map((s) => s.topic);
  }
  if (input.aggregatedTopics?.length) return input.aggregatedTopics;
  if ("topic" in input && input.topic && typeof input.topic === "string") {
    return [input.topic];
  }
  if (
    "seedPrompt" in input &&
    input.seedPrompt &&
    typeof input.seedPrompt === "string"
  ) {
    return [input.seedPrompt];
  }
  return null;
}

/**
 * The main flow for Round 1, responsible for generating a concrete blog post
 * idea.
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
    const newsSummary =
      headlines.length ?
        `Recent headlines for context:\n${
          headlines.map((h) => `- ${h}`).join("\n")}` :
        "No recent news found; relying on general knowledge.";

    const useSearchTool = headlines.length < 3;
    if (useSearchTool) {
      console.log(
        "[r1Ideate] News context is sparse. " +
          "Enabling GoogleSearchTool as a fallback."
      );
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

    type IdeationObject = Partial<z.infer<typeof r1IdeateOutput>>;
    let ideationObj: IdeationObject;
    try {
      ideationObj = safeParseJsonFromAI(rawOutput);
    } catch (err) {
      console.error("[r1Ideate] JSON parse failed", {raw: rawOutput, err});
      throw new Error("Failed to parse prompt output");
    }

    ideationObj.pipelineId = pipelineId;
    ideationObj.topic = mainTopic;

    if (ideationObj && Array.isArray(ideationObj.references)) {
      const seen = new Set();
      ideationObj.references = ideationObj.references.filter(
        (r: z.infer<typeof referenceSchema>) => {
          if (!r?.url || seen.has(r.url)) return false;
          seen.add(r.url);
          return true;
        }
      );
    }

    const parsedIdeationObj = r1IdeateOutput.parse(ideationObj);

    console.log(`[r1Ideate] Generated idea: "${parsedIdeationObj.title}"`);

    const storageResult = await round1StorageStep(
      pipelineId,
      parsedIdeationObj,
      parsedInput
    );

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
