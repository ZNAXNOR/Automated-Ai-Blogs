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

const Round4ItemSchema = z.object({
  idea: z.string(),
  polishedDraft: z.string(),
  // ... other R4 fields if needed
});

const Round4OutputSchema = z.object({
  items: z.array(Round4ItemSchema),
});

const MetaSchema = z.object({
  seoTitle: z.string().max(70, "SEO title must be 70 characters or less."),
  metaDescription: z.string().max(160, "Meta description must be 160 characters or less."),
  tags: z.array(z.string()).min(3, "Must have at least 3 tags."),
  categories: z.array(z.string()).min(1, "Must have at least 1 category."),
  excerpt: z.string().refine((s) => {
    const wordCount = s.trim().split(/\s+/).length;
    return wordCount >= 50 && wordCount <= 100;
  }, "Excerpt must be between 50 and 100 words."),
  relatedKeywords: z.array(z.string()).min(3, "Must have at least 3 related keywords."),
  imageSuggestions: z.array(z.string()).min(1, "Must have at least one image suggestion."),
});

const Round5ItemSchema = z.object({
  idea: z.string(),
  meta: MetaSchema,
});

const Round5OutputSchema = z.object({
  items: z.array(Round5ItemSchema),
});

const FailedItemSchema = z.object({
  item: Round4ItemSchema,
  error: z.string(),
});


// --- Constants ----------------------------------------------------------------

const ROUND = 5;
const CONCURRENCY = 3;
const RETRIES = 2;
const MIN_DRAFT_LENGTH = 250;

// --- Admin SDK ----------------------------------------------------------------

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Helper Functions ---------------------------------------------------------

async function getRound4Data(runId: string): Promise<z.infer<typeof Round4OutputSchema>> {
  const docRef = db.doc(constants.ARTIFACT_PATHS.R4_POLISHED.replace("{runId}", runId));
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

function buildPrompt(draft: string): string {
  return `
    System: You are an expert SEO strategist. Generate the following outputs as a single, valid JSON object:
    1. seoTitle (string, <= 70 chars)
    2. metaDescription (string, <= 160 chars)
    3. tags (array of strings, min 3)
    4. categories (array of strings, min 1)
    5. excerpt (string, 50-100 words)
    6. relatedKeywords (array of strings, min 3)
    7. imageSuggestions (array of strings, at least one prompt or reuse)

    Draft:
    ${draft}
  `;
}

const metaGenerator = (prompt: string) => hfComplete(prompt, env.hfModelR5);

async function generateSingleMeta(
  item: z.infer<typeof Round4ItemSchema>,
  runId: string,
  generator: (prompt: string) => Promise<string> = metaGenerator
): Promise<z.infer<typeof Round5ItemSchema>> {
  if (item.polishedDraft.length < MIN_DRAFT_LENGTH) {
    throw new Error(`Draft for \"${item.idea}\" is too short.`);
  }
  const prompt = buildPrompt(item.polishedDraft);

  let lastError: any;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const rawText = await generator(prompt);
      const jsonText = extractJsonFromText(rawText);
      if (!jsonText) {
        throw new Error("No valid JSON found in LLM response.");
      }
      const parsed = JSON.parse(jsonText);
      const validationResult = MetaSchema.safeParse(parsed);
      if (!validationResult.success) {
        throw new Error(`LLM response validation failed: ${validationResult.error.message}`);
      }
      return { idea: item.idea, meta: validationResult.data };
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${i + 1} failed for meta generation for "${item.idea}"`, { runId, error });
    }
  }
  throw lastError;
}

async function writeArtifacts(
  runId: string,
  successfulItems: z.infer<typeof Round5ItemSchema>[],
  failedItems: z.infer<typeof FailedItemSchema>[]
): Promise<void> {
  if (successfulItems.length === 0 && failedItems.length === 0) {
    logger.warn("No artifacts to write for Round 5.", { runId });
    return;
  }

  const batch = db.batch();

  if (successfulItems.length > 0) {
    const successPath = constants.ARTIFACT_PATHS.R5_METADATA.replace("{runId}", runId);
    batch.set(db.doc(successPath), {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      items: successfulItems,
    });
  }

  // No explicit failure artifact for R5 yet, just logging.

  await batch.commit();
}

// --- Main Function ------------------------------------------------------------

export async function run(
  payload: JobPayload
): Promise<{ metaCount: number; failures: number }> {
  const { runId } = payload;
  if (typeof runId !== "string" || !runId) {
    throw new HttpsError("invalid-argument", "runId must be a non-empty string.");
  }
  logger.info(`Round ${ROUND}: Meta starting`, { runId });

  const { items: r4Items } = await getRound4Data(runId);

  const limit = pLimit(CONCURRENCY);
  const successfulItems: z.infer<typeof Round5ItemSchema>[] = [];
  const failedItems: z.infer<typeof FailedItemSchema>[] = [];

  const promises = r4Items.map((item) =>
    limit(async () => {
      try {
        const metaItem = await generateSingleMeta(item, runId);
        successfulItems.push(metaItem);
      } catch (error: any) {
        logger.error(`Failed to generate meta for "${item.idea}"`, { runId, error: error.message });
        failedItems.push({ item, error: error.message });
      }
    })
  );

  await Promise.all(promises);

  await writeArtifacts(runId, successfulItems, failedItems);

  const result = { metaCount: successfulItems.length, failures: failedItems.length };
  logger.info(`Round ${ROUND}: Meta finished`, { runId, ...result });
  return result;
}

export const Round5_Meta = onCall(
  { timeoutSeconds: 300, memory: "512MiB", region: env.region },
  (req) => run(req.data)
);

// --- Exports for testing ------------------------------------------------------

export const _test = {
  buildPrompt,
  generateSingleMeta,
  run,
};
