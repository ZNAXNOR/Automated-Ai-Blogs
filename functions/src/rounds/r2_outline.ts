import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { env } from "../utils/config";
import { logger } from "../utils/logger";
import { ARTIFACT_PATHS } from "../utils/constants";
import { hfComplete } from "../clients/hf";
import { Round1OutputSchema } from "../utils/schema";
import { JobPayload } from "../utils/types";

// --- Types and Schemas --------------------------------------------------------

const OutlineSectionSchema = z.object({
  heading: z.string(),
  bullets: z.array(z.string()),
  estWordCount: z.number(),
});

const OutlineItemSchema = z.object({
  trend: z.string(),
  idea: z.string(),
  sections: z.array(OutlineSectionSchema),
});

const LlmResponseSchema = z.array(OutlineItemSchema);

const Round2OutputSchema = z.object({
  items: z.array(OutlineItemSchema),
});

// --- Constants ----------------------------------------------------------------

const ROUND = 2;

// --- Admin SDK ----------------------------------------------------------------

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Helper Functions ---------------------------------------------------------

async function getRound1Data(runId: string): Promise<z.infer<typeof Round1OutputSchema>> {
  const r1DocRef = db.doc(ARTIFACT_PATHS.R1_IDEATION.replace("{runId}", runId));
  const r1Snap = await r1DocRef.get();
  if (!r1Snap.exists) {
    throw new HttpsError("not-found", `Round 1 artifact not found for runId=${runId}`);
  }

  const validationResult = Round1OutputSchema.safeParse(r1Snap.data());
  if (!validationResult.success) {
    logger.error("Round 1 data validation failed", { runId, error: validationResult.error });
    throw new HttpsError("internal", "Round 1 data validation failed");
  }

  if (validationResult.data.items.length === 0) {
    throw new HttpsError("failed-precondition", "R1 artifact has no items.");
  }

  return validationResult.data;
}

function buildPrompt(items: z.infer<typeof Round1OutputSchema>["items"]): string {
  const ideasAsJson = JSON.stringify(
    items.map(({ trend, idea }) => ({ trend, idea })),
    null,
    2
  );
  return `
    Given a list of trends and corresponding content ideas, generate a detailed article outline for each.

    INPUT:
    ${ideasAsJson}

    INSTRUCTIONS:
    For each idea, create an outline with these properties:
    - "trend": The original trend.
    - "idea": The original idea.
    - "sections": An array of objects, where each object has:
      - "heading": A descriptive heading for the section (e.g., "Introduction", "The Rise of AI in Healthcare").
      - "bullets": An array of strings, with each string being a key point or question to cover in that section.
      - "estWordCount": A number representing the estimated word count for the section.

    The final output MUST be a single, clean JSON array of outline objects. Do not include any text or formatting before or after the JSON.

    Example Output:
    [
      {
        "trend": "AI in healthcare",
        "idea": "How AI is revolutionizing patient diagnostics",
        "sections": [
          {
            "heading": "Introduction",
            "bullets": [
              "Brief overview of AI\'s growing role in medicine.",
              "Thesis: AI-powered diagnostics are improving accuracy and speed, leading to better patient outcomes."
            ],
            "estWordCount": 150
          },
          {
            "heading": "Conclusion",
            "bullets": [
              "Summary of key benefits.",
              "Future outlook and potential challenges."
            ],
            "estWordCount": 200
          }
        ]
      }
    ]
    `;
}

function extractJsonFromText(text: string): string | null {
    const match = text.match(/(\[[\s\S]*\])/);
    return match ? match[0] : null;
}

async function generateOutlines(items: z.infer<typeof Round1OutputSchema>["items"]): Promise<z.infer<typeof LlmResponseSchema>> {
  const prompt = buildPrompt(items);
  const rawText = await hfComplete(prompt, env.hfModelR2);
  const jsonText = extractJsonFromText(rawText);

  if (!jsonText) {
    logger.error("No valid JSON found in model response for Round 2", { rawText });
    throw new HttpsError("internal", "No valid JSON found in model response for Round 2");
  }

  try {
    const parsed = JSON.parse(jsonText);
    return LlmResponseSchema.parse(parsed);
  } catch (error) {
    logger.error("Failed to parse LLM response for Round 2", { jsonText, error });
    throw new HttpsError("internal", "Failed to parse LLM response for Round 2", { error });
  }
}

async function writeArtifact(runId: string, items: z.infer<typeof Round2OutputSchema>["items"]): Promise<void> {
  const payload = { items };
  const validationResult = Round2OutputSchema.safeParse(payload);

  if (!validationResult.success) {
    logger.error("Round 2 Output validation failed", { runId, error: validationResult.error });
    throw new HttpsError("internal", "Round 2 Output validation failed");
  }

  const r2ArtifactPath = ARTIFACT_PATHS.R2_OUTLINE.replace("{runId}", runId);
  await db.doc(r2ArtifactPath).set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...validationResult.data,
  });
}

// --- Main Function ------------------------------------------------------------

export async function run(payload: JobPayload) {
  const { runId } = payload;
  if (typeof runId !== "string" || !runId) {
    throw new HttpsError("invalid-argument", "runId must be a non-empty string.");
  }
  logger.info(`Round ${ROUND}: Outline starting`, { runId });

  const { items: r1Items } = await getRound1Data(runId);
  const outlines = await generateOutlines(r1Items);
  await writeArtifact(runId, outlines);

  logger.info(`Round ${ROUND}: Outline finished`, { runId, wrote: outlines.length });
  return { wrote: outlines.length };
}

export const Round2_Outline = onCall(
  { timeoutSeconds: 180, memory: "256MiB", region: env.region },
  (req) => run(req.data)
);

// --- Exports for testing ------------------------------------------------------

export const _test = {
    buildPrompt,
    extractJsonFromText,
    generateOutlines,
    run,
};
