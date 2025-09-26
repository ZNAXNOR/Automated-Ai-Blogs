/**
 * Orchestrator
 * ---------------------
 * Coordinates the execution of the full blog pipeline in production.
 * - Initializes run metadata in Firestore
 * - Executes the pipeline (R0 → R7)
 * - Updates run status (SUCCEEDED / FAILED)
 * - Ensures idempotency (does not re-run finished runs)
 * - Logs progress and errors
 */

import { logger } from "./logger";
import { constants } from "./constants";
import { fullBlogPipeline } from "../full_blog_pipeline";
import * as admin from "firebase-admin";

// Define return type for orchestrator
export interface OrchestratorResult {
  runId: string;
  status: "SUCCEEDED" | "FAILED";
  error?: string;
}

/**
 * Run orchestrator for a given runId and seeds.
 */
export async function runOrchestrator(
  runId: string,
  seeds: string[]
): Promise<OrchestratorResult> {
  const runRef = admin.firestore().collection(constants.RUNS_COLLECTION).doc(runId);

  // 1. Check if run already exists (idempotency)
  const existing = await runRef.get();
  if (existing.exists) {
    const data = existing.data();
    if (data?.status === "SUCCEEDED" || data?.status === "FAILED") {
      logger.info(`Run ${runId} already finished. Returning existing status.`);
      return { runId, status: data.status, error: data.error };
    }
  }

  // 2. Initialize run metadata
  await runRef.set({
    runId,
    seeds,
    status: "RUNNING",
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    error: null,
  });

  try {
    logger.info(`Starting pipeline for runId=${runId}`);

    // 3. Execute the pipeline
    await fullBlogPipeline(runId, seeds);

    // 4. Mark success
    await runRef.update({
      status: "SUCCEEDED",
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Pipeline succeeded for runId=${runId}`);
    return { runId, status: "SUCCEEDED" };
  } catch (err: any) {
    // 5. Mark failure
    const message = err?.message || "Unknown error";
    await runRef.update({
      status: "FAILED",
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      error: message,
    });

    logger.error(`Pipeline failed for runId=${runId}`, message);
    return { runId, status: "FAILED", error: message };
  }
}
