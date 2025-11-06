/**
 * @file Develops a unique angle and structured outline for the blog post.
 * @author Omkar Dalvi
 *
 * This flow (Round 2) takes a single blog idea and expands it into a full-fledged outline.
 * It performs the following steps:
 * 1. Extracts reference URLs from the input idea.
 * 2. Fetches and summarizes the content from each URL to be used as research material.
 * 3. Handles transient network errors with a retry mechanism during content fetching.
 * 4. Uses a generative AI prompt to synthesize the research into a coherent outline, including a title, hook, and structured sections.
 * 5. Validates the AI-generated outline against the defined schema.
 * 6. Persists the final outline and research notes to a storage bucket.
 */

import {ai} from "../../clients/genkitInstance.client";
import {r2AngleInput, r2AngleOutput} from "../../schemas/flows/r2_angle.schema";
import {safeParseJsonFromAI} from "../../clients/aiParsing.client";
import {urlContextTool} from "../../tools/urlContext.tool";
import {round2StorageStep} from "./r2_storage.step";

console.log("[r2Angle] Flow module loaded");

/**
 * Fetches and summarizes content from a given URL with a retry mechanism.
 * This function is designed to be resilient to transient network issues.
 * @param url The URL to fetch context from.
 * @param retries The number of retry attempts.
 * @return A promise that resolves to the summarized context or null if it fails.
 */
async function fetchUrlWithRetry(url: string, retries = 2): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[r2Angle] Fetching context for: ${url} (Attempt ${i + 1})`);
      const context = await urlContextTool({url});
      // A basic validation to ensure the summary is meaningful before returning.
      if (context?.summary && context.summary.trim().length > 100) {
        return context;
      }
      console.warn(`[r2Angle] Summary for ${url} is too short. Retrying...`);
    } catch (err) {
      console.error(`[r2Angle] Failed to fetch ${url} on attempt ${i + 1}:`, err);
      if (i === retries - 1) return null; // Return null after the last retry fails.
      // Use exponential backoff for retries to avoid overwhelming the server.
      await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
    }
  }
  return null;
}

/**
 * The main flow for Round 2, responsible for creating a detailed outline and research notes.
 */
export const r2Angle = ai.defineFlow(
  {
    name: "round2Angle",
    inputSchema: r2AngleInput,
    outputSchema: r2AngleOutput,
  },
  async (input) => {
    console.log("[r2Angle] Starting flow with input:", input);
    const {pipelineId, references, ...idea} = input as any;

    if (!references || references.length === 0) {
      console.warn("[r2Angle] No references provided. Proceeding without research notes.");
    }

    // Fetch and summarize content from all provided reference URLs.
    const researchNotes: any[] = [];
    for (const ref of references ?? []) {
      if (!ref?.url) continue;
      const context = await fetchUrlWithRetry(ref.url);
      if (context) {
        researchNotes.push({
          url: context.url ?? ref.url,
          title: context.title ?? ref.title,
          // Truncate the summary to keep the prompt efficient and focused.
          summary: context.summary.slice(0, 800),
        });
      }
    }
    console.log(`[r2Angle] Collected ${researchNotes.length} research notes.`);

    // Use an AI prompt to synthesize the research and idea into a structured outline.
    const anglePrompt = ai.prompt("round2AnglePrompt");
    const resp = await anglePrompt({
      topicIdea: JSON.stringify(idea),
      researchNotes: JSON.stringify(researchNotes),
    });

    const rawOutput = resp.text ?? JSON.stringify(resp.output);
    if (!rawOutput) {
      throw new Error("[r2Angle] AI prompt returned no usable output.");
    }

    // Parse the AI response and validate it against the output schema.
    const angleResult = safeParseJsonFromAI(rawOutput);
    const finalOutput = r2AngleOutput.parse({
      ...angleResult,
      pipelineId,
      researchNotes,
    });

    console.log(`[r2Angle] Generated outline with ${finalOutput.outline.sections.length} sections.`);

    // Persist the generated outline and research for the next round.
    const storageResult = await round2StorageStep(pipelineId, finalOutput);

    return {...finalOutput, __storage: storageResult};
  }
);
