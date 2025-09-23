/**
 * Round 4: Polish & Derive
 *
 * This round takes the raw drafts from Round 3, uses an LLM to polish the text,
 * and generates several derivative content formats (e.g., social media posts, email snippets).
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fetch from "node-fetch";
import pLimit from "p-limit";
import { z } from "zod";
import { env } from "../utils/config";
import { logger } from "../utils/logger";
import { ResponseWrapper } from "../utils/responseHelper";
import { ARTIFACT_PATHS } from "../utils/constants";
import {
  Round3OutputSchema,
  Round4InputSchema,
  Round4OutputSchema,
  DraftItem,
  PolishedDraftItem as R4PolishedItem,
} from "../utils/schema";

export { R4PolishedItem };
export type R3DraftDocument = z.infer<typeof Round3OutputSchema>;

// --- 1. CONFIGURATION ---
const CONCURRENCY = 5;
const POLISH_VERSION = "v1.2"; // Incremented version due to major refactor
const RETRIES = 2;
const DRAFT_TIMEOUT = 30000; // 30 seconds

// Schema for the raw output from the LLM
const LlmResponseSchema = z.object({
  polished: z.string().min(100),
  derivatives: z.array(z.string().min(1)).min(2),
});

export interface FailedDraft {
  draft: DraftItem;
  error: string;
  timestamp: number;
}

// --- 2. I/O OPERATIONS ---

async function fetchR3Data(
  runId: string,
  db = getFirestore()
): Promise<DraftItem[]> {
  logger.info("R4: Fetching R3 data", { runId });
  const r3ArtifactPath = ARTIFACT_PATHS.R3_DRAFT.replace("{runId}", runId);
  const r3Snap = await db.doc(r3ArtifactPath).get();

  if (!r3Snap.exists) {
    logger.error("R3 artifact not found", { runId, path: r3ArtifactPath });
    throw new Error(`R3 artifact not found for runId=${runId}`);
  }

  const r3Data = r3Snap.data();
  const validationResult = Round3OutputSchema.safeParse(r3Data);

  if (!validationResult.success) {
    logger.error("R3 data validation failed", {
      runId,
      error: validationResult.error,
    });
    throw new Error("R3 data validation failed");
  }

  logger.info(`R4: Fetched and validated ${validationResult.data.items.length} drafts from R3.`, { runId });
  return validationResult.data.items;
}

async function saveR4Polish(
  runId: string,
  polishedItems: R4PolishedItem[],
  failedItems: FailedDraft[],
  db = getFirestore()
): Promise<void> {
  if (polishedItems.length === 0 && failedItems.length === 0) {
    logger.info("R4: No polished or failed items to save.", { runId });
    return;
  }

  logger.info(`R4: Saving ${polishedItems.length} polished items and ${failedItems.length} failures.`, { runId });

  const batch = db.batch();

  if (polishedItems.length > 0) {
    const outputForValidation: z.infer<typeof Round4OutputSchema> = {
      items: polishedItems,
    };
    const validationResult = Round4OutputSchema.safeParse(outputForValidation);

    if (!validationResult.success) {
        logger.error("R4 output validation failed before saving", { runId, error: validationResult.error });
        throw new Error("R4 output validation failed");
    }

    const successArtifactPath = ARTIFACT_PATHS.R4_POLISHED_DRAFT.replace("{runId}", runId);
    const successRef = db.doc(successArtifactPath);
    batch.set(successRef, {
      ...validationResult.data,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  if (failedItems.length > 0) {
    const failureRef = db.doc(`runs/${runId}/artifacts/round4_failures`);
    batch.set(failureRef, {
      items: failedItems,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  logger.info("R4: Successfully saved artifacts.", { runId });
}

// --- 3. CORE LOGIC ---

async function processSingleDraft(
  draftDoc: DraftItem,
  llmApiCall: (prompt: string) => Promise<ResponseWrapper> = callHuggingFace
): Promise<R4PolishedItem> {
  const prompt = buildPrompt(draftDoc.draft);

  let llmResponse: ResponseWrapper | null = null;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const timeoutPromise = new Promise<ResponseWrapper>((_, reject) =>
        setTimeout(() => reject(new Error("LLM call timed out")), DRAFT_TIMEOUT)
      );
      llmResponse = await Promise.race([llmApiCall(prompt), timeoutPromise]);
      break; // Success
    } catch (error: any) {
      if (i === RETRIES) {
        throw new Error(`LLM call failed after ${RETRIES} retries: ${error.message}`);
      }
    }
  }

  if (!llmResponse) {
      throw new Error("LLM response was null after retries");
  }

  const llmOutput = await llmResponse.json(LlmResponseSchema);

  const polishedItem: R4PolishedItem = {
    idea: draftDoc.idea,
    polishedDraft: llmOutput.polished,
  };

  return polishedItem;
}

// --- 4. API & UTILITY FUNCTIONS ---

async function callHuggingFace(prompt: string): Promise<ResponseWrapper> {
  const apiKey = env.hfToken;
  const modelId = env.hfModelR4;

  if (!apiKey || !modelId) {
    throw new Error("Hugging Face API key or model for R4 is not set.");
  }

  const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 1024 } }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Hugging Face R4 API Error", { status: response.status, body: errorBody });
    throw new Error(`Hugging Face R4 API Error: ${response.status} ${response.statusText}`);
  }

  return ResponseWrapper.create(response);
}

function buildPrompt(draftText: string): string {
  return `
System: You are a professional content editor. You will refine a draft blog post into polished, human-readable text of at least 100 words. Then, you will create a minimum of two relevant distribution formats (like social media posts, email snippets, or tweet threads). Where suitable, embed inline suggestions for images like [image: a photo of a robot writing at a desk].

Your output must be a single, valid JSON object with the following structure: {"polished": "...", "derivatives": ["...", "..."]}. Do not include any text before or after the JSON object.

User: Here is the draft blog post. Please polish it and generate the derivatives.

Draft:
${draftText.trim()}
`;
}

// --- 5. MAIN ORCHESTRATION FUNCTION ---

export async function Round4_Polish(
  runId: string,
  dependencies: {
    llmApiCall?: (prompt: string) => Promise<ResponseWrapper>;
    firestore?: any;
  } = {}
): Promise<{ polishedCount: number; failures: number }> {
  const db = dependencies.firestore || getFirestore();
  logger.info(`R4: Starting Polish & Derive`, { runId });

  try {
    const drafts = await fetchR3Data(runId, db);
    const validationResult = Round4InputSchema.safeParse({ items: drafts });
    if (!validationResult.success) {
        logger.error("R4 input validation failed", { runId, error: validationResult.error });
        throw new Error("R4 input validation failed");
    }

    const limit = pLimit(CONCURRENCY);
    const failedItems: FailedDraft[] = [];

    const promises = validationResult.data.items.map((draft) =>
      limit(async () => {
        try {
          const polishedItem = await processSingleDraft(draft, dependencies.llmApiCall);
          return polishedItem;
        } catch (error: any) {
          logger.error(`R4: Failed to polish draft for idea: ${draft.idea}`, { runId, error: error.message });
          failedItems.push({ draft, error: error.message, timestamp: Date.now() });
          return null; // Indicate failure
        }
      })
    );

    const results = await Promise.all(promises);
    const successfulItems = results.filter((item): item is R4PolishedItem => item !== null);

    await saveR4Polish(runId, successfulItems, failedItems, db);

    logger.info(`R4: Finished. Successes: ${successfulItems.length}, Failures: ${failedItems.length}`, { runId });

    return { polishedCount: successfulItems.length, failures: failedItems.length };
  } catch (err: any) {
    logger.error("R4: Critical error in main orchestration", { runId, message: err.message });
    throw err; // Re-throw for the top-level handler
  }
}
