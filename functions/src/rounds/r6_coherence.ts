import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import pLimit from "p-limit";
import { env } from "../utils/config";
import { logger } from "../utils/logger";
import { constants } from "../utils/constants";
import { calculateSimilarity } from "../clients/hf_sentence";
import { R5Meta, R6Coherence, JobPayload } from "../utils/types";

// --- Schemas ------------------------------------------------------------------

const R5OutputSchema = z.object({
  items: z.array(R5Meta),
});

const FailedItemSchema = z.object({
  item: R5Meta,
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

async function getR5Data(runId: string): Promise<z.infer<typeof R5OutputSchema>> {
  const docRef = db.doc(constants.ARTIFACT_PATHS.R5_METADATA.replace("{runId}", runId));
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new HttpsError("not-found", `Round 5 artifact not found for runId=${runId}`);
  }

  const validationResult = R5OutputSchema.safeParse(docSnap.data());
  if (!validationResult.success) {
    logger.error("Round 5 data validation failed", { runId, error: validationResult.error });
    throw new HttpsError("internal", "Round 5 data validation failed");
  }
  if (validationResult.data.items.length === 0) {
    throw new HttpsError("failed-precondition", "R5 artifact has no items.");
  }

  return validationResult.data;
}

async function analyzeCoherence(
  item: R5Meta
): Promise<R6Coherence> {
  const sentences = item.draft.split(". ");
  const scores = await calculateSimilarity(item.draft, sentences);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  return {
    ...item,
    coherenceScores: {
      overall: averageScore,
      sentence: scores,
    },
  };
}

async function writeArtifacts(
  runId: string,
  successfulItems: R6Coherence[],
  failedItems: z.infer<typeof FailedItemSchema>[]
): Promise<void> {
  if (successfulItems.length === 0 && failedItems.length === 0) {
    logger.warn("No artifacts to write for Round 6.", { runId });
    return;
  }

  const batch = db.batch();

  if (successfulItems.length > 0) {
    const successPath = constants.ARTIFACT_PATHS.R6_COHERENCE.replace("{runId}", runId);
    batch.set(db.doc(successPath), {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      items: successfulItems,
    });
  }

  // No explicit failure artifact for R6 yet, just logging.

  await batch.commit();
}

// --- Main Function ------------------------------------------------------------

export async function run(
  payload: JobPayload
): Promise<{ coherenceCount: number; failures: number }> {
  const { runId } = payload;
  if (typeof runId !== "string" || !runId) {
    throw new HttpsError("invalid-argument", "runId must be a non-empty string.");
  }
  logger.info(`Round ${ROUND}: Coherence starting`, { runId });

  const { items: r5Items } = await getR5Data(runId);

  const limit = pLimit(CONCURRENCY);
  const successfulItems: R6Coherence[] = [];
  const failedItems: z.infer<typeof FailedItemSchema>[] = [];

  const promises = r5Items.map((item) =>
    limit(async () => {
      try {
        const coherenceItem = await analyzeCoherence(item);
        successfulItems.push(coherenceItem);
      } catch (error: any) {
        logger.error(`Failed to analyze coherence for \"${item.title}\"`, { runId, error: error.message });
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
  (req) => run(req.data)
);
