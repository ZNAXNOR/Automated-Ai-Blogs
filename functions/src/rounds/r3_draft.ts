import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { env } from "../utils/config";
import { logger } from "../utils/logger";
import { ARTIFACT_PATHS } from "../utils/constants";
import { hfComplete } from "../clients/hf";
import pLimit from "p-limit";

// --- Schemas ------------------------------------------------------------------

const OutlineSectionSchema = z.object({
  heading: z.string(),
  bullets: z.array(z.string()),
  estWordCount: z.number(),
});

const R2OutlineItemSchema = z.object({
  trend: z.string(),
  idea: z.string(),
  sections: z.array(OutlineSectionSchema),
});

const Round2OutputSchema = z.object({
  items: z.array(R2OutlineItemSchema),
});

const DraftDocumentSchema = z.object({
  runId: z.string(),
  trend: z.string(),
  idea: z.string(),
  outline: z.string(),
  draft: z.string(),
  wordCount: z.number(),
  metadata: z.object({
    createdAt: z.number(),
    retries: z.number(),
    promptWordCount: z.number(),
  }),
});

const Round3OutputSchema = z.object({
  items: z.array(DraftDocumentSchema),
});

// --- Constants ----------------------------------------------------------------

const ROUND = 3;
const MAX_DRAFT_RETRIES = 2;
const MIN_DRAFT_WORDS = 250;
const MAX_DRAFT_WORDS = 2000;
const CONCURRENCY = 4;

// --- Admin SDK ----------------------------------------------------------------

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Helper Functions ---------------------------------------------------------

async function getRound2Data(runId: string): Promise<z.infer<typeof Round2OutputSchema>> {
  const r2DocRef = db.doc(ARTIFACT_PATHS.R2_OUTLINE.replace("{runId}", runId));
  const r2Snap = await r2DocRef.get();
  if (!r2Snap.exists) {
    throw new HttpsError("not-found", `Round 2 artifact not found for runId=${runId}`);
  }

  const validationResult = Round2OutputSchema.safeParse(r2Snap.data());
  if (!validationResult.success) {
    logger.error("Round 2 data validation failed", { runId, error: validationResult.error });
    throw new HttpsError("internal", "Round 2 data validation failed");
  }

  if (validationResult.data.items.length === 0) {
    throw new HttpsError("failed-precondition", "R2 artifact has no items.");
  }

  return validationResult.data;
}

function convertOutlineToString(item: z.infer<typeof R2OutlineItemSchema>): string {
  return item.sections
    .map((s) => `## ${s.heading}\n${s.bullets.map((b) => `- ${b}`).join("\n")}`)
    .join("\n\n");
}

function buildPrompt(item: z.infer<typeof R2OutlineItemSchema>, outlineString: string): string {
  return `Write a long-form, engaging, coherent draft based on the following outline. Aim for between ${MIN_DRAFT_WORDS} and ${MAX_DRAFT_WORDS} words. Make the content useful and avoid empty output.\n\nTREND: ${item.trend}\nIDEA: ${item.idea}\nOUTLINE:\n${outlineString}\n\nDRAFT:`;
}

function wordCount(text: string): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function sanitizeDraft(draft: string, prompt: string): string {
  const trimmedDraft = draft.trim();
  const trimmedPrompt = prompt.trim();
  if (trimmedDraft.startsWith(trimmedPrompt)) {
    return trimmedDraft.substring(trimmedPrompt.length).trim();
  }
  return trimmedDraft;
}

// Wrapper for hfComplete to match the expected generator signature
const draftGenerator = (prompt: string) => hfComplete(prompt, env.hfModelR3);

async function generateDraftForOutline(
  item: z.infer<typeof R2OutlineItemSchema>,
  runId: string,
  generator: (prompt: string) => Promise<string> = draftGenerator
): Promise<z.infer<typeof DraftDocumentSchema>> {
  const outlineString = convertOutlineToString(item);
  const prompt = buildPrompt(item, outlineString);

  let draft = "";
  let finalWordCount = 0;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_DRAFT_RETRIES; attempt++) {
    retries = attempt;
    const rawDraft = await generator(prompt);
    draft = sanitizeDraft(rawDraft, prompt);
    finalWordCount = wordCount(draft);

    if (finalWordCount >= MIN_DRAFT_WORDS && finalWordCount <= MAX_DRAFT_WORDS) {
      break;
    }

    logger.warn(`Draft for "${item.idea}" did not meet word count. Retrying...`, {
      runId,
      attempt,
      wordCount: finalWordCount,
    });
  }

  if (finalWordCount < MIN_DRAFT_WORDS || finalWordCount > MAX_DRAFT_WORDS) {
    throw new Error(`Draft word count (${finalWordCount}) is out of range.`);
  }

  const draftDoc = {
    runId,
    trend: item.trend,
    idea: item.idea,
    outline: outlineString,
    draft,
    wordCount: finalWordCount,
    metadata: {
      createdAt: Date.now(),
      retries,
      promptWordCount: wordCount(prompt),
    },
  };

  return DraftDocumentSchema.parse(draftDoc);
}

async function writeArtifact(
  runId: string,
  drafts: z.infer<typeof DraftDocumentSchema>[]
): Promise<void> {
  const payload = { items: drafts };
  const validationResult = Round3OutputSchema.safeParse(payload);

  if (!validationResult.success) {
    logger.error("Round 3 Output validation failed", { runId, error: validationResult.error });
    throw new HttpsError("internal", "Round 3 Output validation failed");
  }

  const r3ArtifactPath = ARTIFACT_PATHS.R3_DRAFT.replace("{runId}", runId);
  await db.doc(r3ArtifactPath).set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...validationResult.data,
  });
}

// --- Main Function ------------------------------------------------------------

export async function runR3_Draft(
  runId: string
): Promise<{ draftsCreated: number; failures: number }> {
  logger.info(`Round ${ROUND}: Draft starting`, { runId });

  const { items: r2Items } = await getRound2Data(runId);

  const limit = pLimit(CONCURRENCY);
  let successes = 0;
  let failures = 0;

  const promises = r2Items.map((item) =>
    limit(async () => {
      try {
        const draft = await generateDraftForOutline(item, runId);
        successes++;
        return draft;
      } catch (error: any) {
        logger.error(`Failed to generate draft for "${item.idea}"`, { runId, error: error.message });
        failures++;
        return null;
      }
    })
  );

  const results = await Promise.all(promises);
  const successfulDrafts = results.filter((d) => d !== null) as z.infer<typeof DraftDocumentSchema>[];

  await writeArtifact(runId, successfulDrafts);

  logger.info(`Round ${ROUND}: Draft finished`, { runId, successes, failures });
  return { draftsCreated: successes, failures };
}

export const Round3_Draft = onCall(
  { timeoutSeconds: 300, memory: "256MiB", region: env.region },
  (req) => {
    const { runId } = req.data;
    if (typeof runId !== "string" || !runId) {
      throw new HttpsError("invalid-argument", "runId must be a non-empty string.");
    }
    return runR3_Draft(runId);
  }
);

// --- Exports for testing ------------------------------------------------------

export const _test = {
  buildPrompt,
  convertOutlineToString,
  generateDraftForOutline,
  sanitizeDraft,
  wordCount,
  runR3_Draft,
};
