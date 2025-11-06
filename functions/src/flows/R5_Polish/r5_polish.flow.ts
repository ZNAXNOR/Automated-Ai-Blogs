/**
 * @file Polishes the draft content to improve readability, tone, and overall quality.
 * @author Omkar Dalvi
 *
 * This flow (Round 5) takes the raw draft and metadata, then refines the content into a
 * final, publish-ready state. It performs the following steps:
 * 1. Combines the draft and metadata to create a comprehensive context for the AI.
 * 2. Uses a generative AI prompt (`polishPrompt`) to:
 *    - Refine grammar, sentence structure, and flow.
 *    - Ensure the tone is consistent with the specified requirements.
 *    - Incorporate any final touches to enhance readability.
 * 3. Implements a retry mechanism to handle potential failures in AI response or parsing.
 * 4. Includes a fallback to use the original draft if polishing fails, ensuring the pipeline doesn't halt.
 * 5. Parses and validates the polished output against a schema.
 * 6. Persists the final polished blog content to a storage bucket.
 */

import {ai} from "../../clients/genkitInstance.client";
import {polishPrompt} from "../../prompts/flows/r5_polish.prompt";
import {r5PolishInput, r5PolishOutput} from "../../schemas/flows/r5_polish.schema";
import {safeParseJsonFromAI} from "../../clients/aiParsing.client";
import {z} from "zod";
import {round5StorageStep} from "./r5_storage.step";

console.log("[r5Polish] Flow module loaded");

/**
 * The main flow for Round 5, responsible for polishing the draft into a final version.
 */
export const r5Polish = ai.defineFlow(
  {
    name: "round5Polish",
    inputSchema: r5PolishInput,
    outputSchema: r5PolishOutput,
  },
  async (input) => {
    const {pipelineId, draft, meta, tone} = input as any;
    if (!pipelineId || typeof pipelineId !== "string") {
      throw new Error("[r5Polish] Invalid or missing pipelineId.");
    }
    const blogTitle = meta?.title ?? draft?.title ?? "Untitled Blog";
    console.log(`[r5Polish] Starting polishing for: \"${blogTitle}\"`);

    // Consolidate draft text from various possible input structures.
    const draftText = draft?.fullDraft ?? draft?.sections?.map((s:any) => s.content).join("\n\n") ?? "";
    if (!draftText) {
      throw new Error("[r5Polish] No draft content provided to polish.");
    }

    let polishedResult: z.infer<typeof r5PolishOutput> | null = null;
    const maxRetries = 2;

    // Implement a retry loop to handle transient errors from the AI model.
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Execute the AI prompt to polish the content.
        const llmResponse = await polishPrompt({
          blogTitle,
          topic: meta?.primaryCategory ?? blogTitle,
          tone: tone,
          fullDraft: draftText,
          meta: meta,
        });

        const rawResponse = llmResponse.text;
        console.log(`[r5Polish] AI response received (attempt ${attempt})`);

        // Parse and validate the response.
        const parsedJson = safeParseJsonFromAI(rawResponse);
        polishedResult = r5PolishOutput.parse({...parsedJson, pipelineId});

        // If parsing and validation are successful, exit the retry loop.
        break;
      } catch (err) {
        console.error(`[r5Polish] Attempt ${attempt} failed:`, err);
        if (attempt === maxRetries) {
          console.warn("[r5Polish] All retries failed. Using unpolished draft as fallback.");
        }
      }
    }

    // If all polishing attempts fail, use the original draft as a fallback.
    if (!polishedResult) {
      polishedResult = {
        pipelineId,
        polishedBlog: draftText,
        readability: {fkGrade: -1}, // Indicates that this is a fallback result.
        usedImages: [],
      };
    }

    console.log(`[r5Polish] Polishing complete. Final length: ${polishedResult.polishedBlog.length} characters.`);

    // Persist the polished content for the final publishing round.
    const storageResult = await round5StorageStep(pipelineId, polishedResult);

    return {...polishedResult, __storage: storageResult};
  }
);
