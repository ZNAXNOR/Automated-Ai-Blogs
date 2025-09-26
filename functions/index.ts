/**
 * Firebase Functions entrypoint
 * Exposes callable + scheduled triggers for orchestrator
 */

import * as functions from "firebase-functions";
import { runOrchestrator } from "./src/utils/orchestrator";
import { v4 as uuidv4 } from "uuid";
import * as admin from "firebase-admin";
import { newFunction } from "./new-function";

admin.initializeApp();

/**
 * Callable function: start a new blog pipeline run
 */
export const startBlogRun = functions.https.onCall(async (data, context) => {
  const seeds: string[] = data?.seeds ?? [];
  const runId: string = data?.runId ?? uuidv4();

  try {
    const result = await runOrchestrator(runId, seeds);
    return result;
  } catch (err: any) {
    throw new functions.https.HttpsError(
      "internal",
      "Pipeline execution failed",
      err?.message || err
    );
  }
});

/**
 * Optional HTTP endpoint for triggering via cron / manual run
 */
export const startBlogRunHttp = functions.https.onRequest(async (req, res) => {
  const seeds: string[] = req.body?.seeds ?? [];
  const runId: string = uuidv4();

  try {
    const result = await runOrchestrator(runId, seeds);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Pipeline execution failed" });
  }
});

export const myNewFunction = functions.https.onCall(async (data, context) => {
    newFunction();
});
