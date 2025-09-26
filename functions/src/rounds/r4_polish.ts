import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import pLimit from "p-limit";
import { env } from "../utils/config";
import { logger } from "../utils/logger";
import { constants } from "../utils/constants";
import { hfComplete, extractJsonFromText } from "../clients/hf";
import { JobPayload } from "../utils/types";

// --- Schemas ------------------------------------------------------------------

const Round3ItemSchema = z.object({
  idea: z.string(),
  draft: z.string(),
  // ... other R3 fields if needed, but keeping it minimal for R4
});

const Round3OutputSchema = z.object({
  items: z.array(Round3ItemSchema),
});

// Schema for the expected raw output from the LLM
const LlmResponseSchema = z.object({
  polished: z.string().min(100, "Polished text must be at least 100 characters."),
  derivatives: z
    .array(z.string().min(1))
    .min(2, "Must have at least two derivative content pieces."),
});

// Schema for the final polished item we will save
const PolishedDraftItemSchema = z.object({
  idea: z.string(),
  polishedDraft: z.string(),
  derivatives: z.array(z.string()),
});

const Round4OutputSchema = z.object({
  items: z.array(PolishedDraftItemSchema),
});

const FailedItemSchema = z.object({
  item: Round3ItemSchema,
  error: z.string(),
});

// --- Constants ----------------------------------------------------------------

const ROUND = 4;
const CONCURRENCY = 4;
const RETRIES = 1;

// --- Admin SDK ----------------------------------------------------------------

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Helper Functions ---------------------------------------------------------

async function getRound3Data(runId: string): Promise<z.infer<typeof Round3OutputSchema>> {
  const docRef = db.doc(constants.ARTIFACT_PATHS.R3_DRAFTS.replace("{runId}", runId));
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new HttpsError("not-found", `Round 3 artifact not found for runId=${runId}`);
  }

  const validationResult = Round3OutputSchema.safeParse(docSnap.data());
  if (!validationResult.success) {
    logger.error("Round 3 data validation failed", { runId, error: validationResult.error });
    throw new HttpsError("internal", "Round 3 data validation failed");
  }
  if (validationResult.data.items.length === 0) {
    throw new HttpsError("failed-precondition", "R3 artifact has no items.");
  }
  return validationResult.data;
}

function buildPrompt(draftText: string): string {
  return `\nSystem: You are a professional content editor. You will refine a draft blog post into polished, human-readable text of at least 100 words. Then, you will create a minimum of two relevant distribution formats (like social media posts, email snippets, or tweet threads). Where suitable, embed inline suggestions for images like [image: a photo of a robot writing at a desk].\n\nYour output must be a single, valid JSON object with the following structure: {\"polished\": \"...\", \"derivatives\": [\"...\", \"...\"]}. Do not include any text before or after the JSON object.\n\nUser: Here is the draft blog post. Please polish it and generate the derivatives.\n\nDraft:\n${draftText.trim()}\n`;
}

const polishGenerator = (prompt: string) => hfComplete(prompt, env.hfModelR4);

async function polishSingleDraft(
  item: z.infer<typeof Round3ItemSchema>,
  runId: string,
  generator: (prompt: string) => Promise<string> = polishGenerator
): Promise<z.infer<typeof PolishedDraftItemSchema>> {
  const prompt = buildPrompt(item.draft);

  let lastError: any;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const rawText = await generator(prompt);
      const jsonText = extractJsonFromText(rawText);
      if (!jsonText) {
        throw new Error("No valid JSON found in LLM response.");
      }

      const parsed = JSON.parse(jsonText);
      const validationResult = LlmResponseSchema.safeParse(parsed);

      if (!validationResult.success) {
        throw new Error(`LLM response validation failed: ${validationResult.error.message}`);
      }

      return {
        idea: item.idea,
        polishedDraft: validationResult.data.polished,
        derivatives: validationResult.data.derivatives,
      };
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${i + 1} failed for polishing draft: \"${item.idea}\"`, { runId, error });
    }
  }
  throw lastError; // Throw the last recorded error after all retries have failed
}

async function writeArtifacts(
  runId: string,
  successfulItems: z.infer<typeof PolishedDraftItemSchema>[],
  failedItems: z.infer<typeof FailedItemSchema>[]
): Promise<void> {
  if (successfulItems.length === 0 && failedItems.length === 0) {
    logger.warn("No artifacts to write for Round 4.", { runId });
    return;
  }

  const batch = db.batch();

  // --- Write Successes ---
  if (successfulItems.length > 0) {
    const successPayload = { items: successfulItems };
    const validationResult = Round4OutputSchema.safeParse(successPayload);
    if (!validationResult.success) {
      logger.error("Final Round 4 output validation failed", { runId, error: validationResult.error });
      // Don't throw, as we still want to record failures
    } else {
      const successPath = constants.ARTIFACT_PATHS.R4_POLISHED.replace("{runId}", runId);
      batch.set(db.doc(successPath), {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...validationResult.data,
      });
    }
  }

  // --- Write Failures ---
  if (failedItems.length > 0) {
    const failurePath = constants.ARTIFACT_PATHS.R4_FAILURES.replace("{runId}", runId);
    batch.set(db.doc(failurePath), {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      items: failedItems,
    });
  }

  await batch.commit();
}

// --- Main Function ------------------------------------------------------------

export async function run(
  payload: JobPayload
): Promise<{ polishedCount: number; failures: number }> {
  const { runId } = payload;
  if (typeof runId !== "string" || !runId) {
    throw new HttpsError("invalid-argument", "runId must be a non-empty string.");
  }
  logger.info(`Round ${ROUND}: Polish starting`, { runId });

  const { items: r3Items } = await getRound3Data(runId);

  const limit = pLimit(CONCURRENCY);
  const successfulItems: z.infer<typeof PolishedDraftItemSchema>[] = [];
  const failedItems: z.infer<typeof FailedItemSchema>[] = [];

  const promises = r3Items.map((item) =>
    limit(async () => {
      try {
        const polishedItem = await polishSingleDraft(item, runId);
        successfulItems.push(polishedItem);
      } catch (error: any) {
        logger.error(`Failed to polish draft for \"${item.idea}\"`, { runId, error: error.message });
        failedItems.push({ item, error: error.message });
      }
    })
  );

  await Promise.all(promises);

  await writeArtifacts(runId, successfulItems, failedItems);

  const result = { polishedCount: successfulItems.length, failures: failedItems.length };
  logger.info(`Round ${ROUND}: Polish finished`, { runId, ...result });
  return result;
}

export const Round4_Polish = onCall(
  { timeoutSeconds: 540, memory: "512MiB", region: env.region },
  (req) => run(req.data)
);

// --- Exports for testing ------------------------------------------------------

export const _test = {
  buildPrompt,
  polishSingleDraft,
  run,
};
