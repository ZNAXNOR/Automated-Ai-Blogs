import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import pLimit from "p-limit";
import { env } from "../utils/config";
import { logger } from "../utils/logger";
import { ARTIFACT_PATHS } from "../utils/constants";
import { calculateSimilarity } from "../clients/hf_sentence";

// --- Schemas ------------------------------------------------------------------

const Round4ItemSchema = z.object({
  idea: z.string(),
  polishedDraft: z.string(),
  derivatives: z.array(z.string()).min(1),
});

const Round4OutputSchema = z.object({
  items: z.array(Round4ItemSchema),
});

const CoherenceItemSchema = z.object({
  idea: z.string(),
  coherenceScore: z.number().min(0).max(1),
});

const Round6OutputSchema = z.object({
  items: z.array(CoherenceItemSchema),
});

const FailedItemSchema = z.object({
  item: Round4ItemSchema,
  error: z.string(),
});

// --- Constants ----------------------------------------------------------------

const ROUND = 6;
const CONCURRENCY = 5;

// --- Admin SDK ----------------------------------------------------------------

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Helper Functions ---------------------------------------------------------

async function getRound4Data(runId: string): Promise<z.infer<typeof Round4OutputSchema>> {
  const docRef = db.doc(ARTIFACT_PATHS.R4_POLISHED_DRAFT.replace("{runId}", runId));
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new HttpsError("not-found", `Round 4 artifact not found for runId=${runId}`);
  }

  const validationResult = Round4OutputSchema.safeParse(docSnap.data());
  if (!validationResult.success) {
    logger.error("Round 4 data validation failed", { runId, error: validationResult.error });
    throw new HttpsError("internal", "Round 4 data validation failed");
  }
  if (validationResult.data.items.length === 0) {
    throw new HttpsError("failed-precondition", "R4 artifact has no items.");
  }

  return validationResult.data;
}

async function analyzeCoherence(
  item: z.infer<typeof Round4ItemSchema>
): Promise<z.infer<typeof CoherenceItemSchema>> {
  const scores = await calculateSimilarity(item.polishedDraft, item.derivatives);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  return { idea: item.idea, coherenceScore: averageScore };
}

async function writeArtifacts(
  runId: string,
  successfulItems: z.infer<typeof CoherenceItemSchema>[],
  failedItems: z.infer<typeof FailedItemSchema>[]
): Promise<void> {
  if (successfulItems.length === 0 && failedItems.length === 0) {
    logger.warn("No artifacts to write for Round 6.", { runId });
    return;
  }

  const batch = db.batch();

  if (successfulItems.length > 0) {
    const successPath = ARTIFACT_PATHS.R6_COHERENCE.replace("{runId}", runId);
    batch.set(db.doc(successPath), {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      items: successfulItems,
    });
  }

  // No explicit failure artifact for R6 yet, just logging.

  await batch.commit();
}

// --- Main Function ------------------------------------------------------------

export async function runR6_Coherence(
  runId: string
): Promise<{ coherenceCount: number; failures: number }> {
  logger.info(`Round ${ROUND}: Coherence starting`, { runId });

  const { items: r4Items } = await getRound4Data(runId);

  const limit = pLimit(CONCURRENCY);
  const successfulItems: z.infer<typeof CoherenceItemSchema>[] = [];
  const failedItems: z.infer<typeof FailedItemSchema>[] = [];

  const promises = r4Items.map((item) =>
    limit(async () => {
      try {
        const coherenceItem = await analyzeCoherence(item);
        successfulItems.push(coherenceItem);
      } catch (error: any) {
        logger.error(`Failed to analyze coherence for "${item.idea}"`, { runId, error: error.message });
        failedItems.push({ item, error: error.message });
      }
    })
  );

  await Promise.all(promises);

  await writeArtifacts(runId, successfulItems, failedItems);

  const result = { coherenceCount: successfulItems.length, failures: failedItems.length };
  logger.info(`Round ${ROUND}: Coherence finished`, { runId, ...result });
  return result;
}

export const Round6_Coherence = onCall(
  { timeoutSeconds: 180, memory: "256MiB", region: env.region },
  (req) => {
    const { runId } = req.data;
    if (typeof runId !== "string" || !runId) {
      throw new HttpsError("invalid-argument", "runId must be a non-empty string.");
    }
    return runR6_Coherence(runId);
  }
);

export const _test = {
  runR6_Coherence,
  analyzeCoherence,
};
