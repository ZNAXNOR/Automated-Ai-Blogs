import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

import { env } from "../utils/config";
import { logger } from "../utils/logger";
import { constants } from "../utils/constants";
import { hfComplete } from "../clients/hf";
import {
  Round1InputSchema,
  Round1OutputSchema,
  type TrendItem,
} from "../utils/schema";
import { JobPayload } from "../utils/types";

// --- Types and Schemas --------------------------------------------------------

export type IdeationItem = z.infer<typeof Round1OutputSchema>["items"][number];

const LlmResponseSchema = z.array(
  z.object({
    trend: z.string(),
    ideas: z.array(z.string()),
  })
);

// --- Constants ----------------------------------------------------------------

const MAX_IDEAS_PER_TREND = 5;
const MIN_IDEAS_PER_TREND = 3;
const MAX_TOTAL_IDEAS = 60;
const ROUND = 1;

// --- Admin SDK ----------------------------------------------------------------

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Helper Functions ---------------------------------------------------------

async function getRound0Data(runId: string): Promise<TrendItem[]> {
  const r0DocRef = db.doc(constants.ARTIFACT_PATHS.R0_TRENDS.replace("{runId}", runId));
  const r0Snap = await r0DocRef.get();
  if (!r0Snap.exists) {
    throw new HttpsError("not-found", `Round0 artifact not found for runId=${runId}`);
  }

  const validationResult = Round1InputSchema.safeParse(r0Snap.data());
  if (!validationResult.success) {
    logger.error("Round 1 Input validation failed", { runId, error: validationResult.error });
    throw new HttpsError("internal", "Round 1 Input validation failed");
  }

  const { items: trends } = validationResult.data;
  if (trends.length === 0) {
    throw new HttpsError("failed-precondition", `No trends found in round0 artifact for runId=${runId}`);
  }

  return trends;
}

function buildPrompt(trendQueries: string[]): string {
  return `You are an expert blog strategist helping select article titles from trending topics.\n\nTASK:\n- For each input trend, generate 3–5 unique, creative blog title ideas.\n- Titles should be short (≤12 words), clear, and engaging.\n- Focus on human readability and search-friendliness.\n- Avoid clickbait and repetition.\n\nOUTPUT FORMAT (strict JSON only):\n[\n  {\n    "trend": "<trend string>",\n    "ideas": ["<title1>", "<title2>", "<title3>"]\n  }\n]\n\nEXAMPLE:\nInput: ["AI in healthcare"]\nOutput:\n[\n  {\n    "trend": "AI in healthcare",\n    "ideas": [\n      "How AI is Transforming Healthcare in 2025",\n      "AI in Hospitals: Benefits and Challenges",\n      "The Future of Medicine with Artificial Intelligence"\n    ]\n  }\n]\n\nInput: ${JSON.stringify(trendQueries)}\n`;
}

async function generateIdeas(trendQueries: string[]): Promise<z.infer<typeof LlmResponseSchema>> {
  const prompt = buildPrompt(trendQueries);
  const llmResponse = await hfComplete(prompt, env.hfModelR1);

  try {
    const parsed = JSON.parse(llmResponse.trim());
    return LlmResponseSchema.parse(parsed);
  } catch (error) {
    logger.error("Failed to parse LLM response", { llmResponse, error });
    throw new HttpsError("internal", "Failed to parse LLM response", { error });
  }
}

function processLlmResponse(llmOutput: z.infer<typeof LlmResponseSchema>, trendQueries: string[]): IdeationItem[] {
  const items: IdeationItem[] = [];
  const trendsMap = new Map<string, number>();

  for (const entry of llmOutput) {
    const trend = String(entry.trend ?? "").trim();
    if (!trend) continue;

    const cleanedIdeas = (entry.ideas ?? [])
      .map((s) => String(s ?? "").trim())
      .filter(Boolean)
      .slice(0, MAX_IDEAS_PER_TREND);

    if (cleanedIdeas.length < MIN_IDEAS_PER_TREND) continue;

    cleanedIdeas.forEach((idea, idx) => {
      items.push({ trend, idea, variant: idx + 1, source: "llm" });
      trendsMap.set(trend, (trendsMap.get(trend) || 0) + 1);
    });
  }

  // Verify all original trends were processed sufficiently
  for (const t of trendQueries) {
    const count = trendsMap.get(t) || 0;
    if (count < MIN_IDEAS_PER_TREND) {
      throw new HttpsError("internal", `Trend "${t}" produced fewer than ${MIN_IDEAS_PER_TREND} ideas (${count}).`);
    }
  }

  return items.slice(0, MAX_TOTAL_IDEAS);
}

async function writeArtifact(runId: string, items: IdeationItem[]): Promise<void> {
  const payload = { items };
  const validationResult = Round1OutputSchema.safeParse(payload);

  if (!validationResult.success) {
    logger.error("Round 1 Output validation failed", { runId, error: validationResult.error });
    throw new HttpsError("internal", "Round 1 Output validation failed");
  }

  const r1ArtifactPath = constants.ARTIFACT_PATHS.R1_IDEAS.replace("{runId}", runId);
  await db.doc(r1ArtifactPath).set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...validationResult.data,
  });
}

// --- Main Function ------------------------------------------------------------

export async function run(payload: JobPayload) {
  const { runId } = payload;
  if (typeof runId !== 'string' || !runId) {
    throw new HttpsError("invalid-argument", "runId must be a non-empty string.");
  }
  logger.info(`Round ${ROUND}: Ideate starting`, { runId });

  const trendsFromDoc = await getRound0Data(runId);

  const trendQueries = Array.from(
    new Set(trendsFromDoc.map((t) => t.query.trim()).filter(Boolean))
  ).slice(0, 12);

  if (trendQueries.length === 0) {
    throw new HttpsError("failed-precondition", "After normalization, no valid trend queries were found.");
  }

  const llmOutput = await generateIdeas(trendQueries);
  const ideationItems = processLlmResponse(llmOutput, trendQueries);

  if (ideationItems.length === 0) {
    throw new HttpsError("internal", "No valid ideation items were produced.");
  }

  await writeArtifact(runId, ideationItems);

  logger.info(`Round ${ROUND}: Ideate finished`, { runId, wrote: ideationItems.length });
  return { wrote: ideationItems.length };
}

export const Round1_Ideate = onCall(
  { timeoutSeconds: 180, memory: "256MiB", region: env.region },
  (req) => run(req.data)
);

export const _test = { run };
