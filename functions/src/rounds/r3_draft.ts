/**
 * Round 3: Draft Generation
 *
 * This round fetches outlines from Round 2, generates a draft for each using an LLM,
 * validates the output, and saves the drafts to Firestore.
 *
 * Key Improvements:
 * - Separation of I/O (fetch/save) from core logic (draft generation).
 * - Parallel draft generation with concurrency limiting.
 * - Stricter validation of both input (outlines) and output (drafts).
 * - Robust retry mechanism for LLM calls to handle word count issues.
 * - Enhanced logging for better traceability.
 * - Improved testability by exporting key functions.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fetch from "node-fetch";
import pLimit from "p-limit";
import { env } from "../utils/config";

// --- 1. DATA MODELS ---

// Input from Round 2
export interface OutlineSection {
  heading: string;
  bullets: string[];
  estWordCount: number;
}

export interface R2OutlineItem {
  trend: string;
  idea: string;
  sections: OutlineSection[];
}

// Output for Round 3
export interface DraftDocument {
  runId: string;
  trend: string;
  idea: string;
  outline: string; // The text version of the R2 outline
  draft: string;
  wordCount: number;
  metadata: {
    createdAt: number; // epoch ms
    retries: number;
    promptWordCount: number;
  };
}

// --- 2. CONFIGURATION ---
const MAX_DRAFT_RETRIES = 2; // Total attempts = 1 initial + 2 retries = 3
const MIN_DRAFT_WORDS = 250;
const MAX_DRAFT_WORDS = 2000;
const CONCURRENCY = 4; // Max parallel LLM requests

// --- 3. I/O OPERATIONS ---

/**
 * Fetches and validates the Round 2 artifact from Firestore.
 */
export async function fetchR2Data(runId: string): Promise<R2OutlineItem[]> {
  console.log(`R3: Fetching R2 data for runId=${runId}`);
  const db = getFirestore();
  const r2Snap = await db.doc(`runs/${runId}/artifacts/round2`).get();

  if (!r2Snap.exists) {
    throw new Error(`R2 artifact not found for runId=${runId}`);
  }

  const items = r2Snap.data()?.items as R2OutlineItem[];
  validateR2Outlines(items);

  console.log(`R3: Fetched and validated ${items.length} outlines from R2.`);
  return items;
}

/**
 * Saves the generated drafts for Round 3 to a single artifact in Firestore.
 */
export async function saveR3Drafts(
  runId: string,
  drafts: DraftDocument[]
): Promise<void> {
  if (drafts.length === 0) {
    console.log("R3: No drafts to save.");
    return;
  }
  console.log(`R3: Saving ${drafts.length} drafts to Firestore for runId=${runId}`);
  const db = getFirestore();
  await db.doc(`runs/${runId}/artifacts/round3`).set({
    items: drafts,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log("R3: Successfully saved drafts.");
}

// --- 4. CORE LOGIC ---

/**
 * Generates a draft for a single outline with validation and retry logic.
 */
export async function generateDraftForOutline(
  item: R2OutlineItem,
  runId: string,
  generator: (prompt: string) => Promise<string> = callHuggingFace
): Promise<DraftDocument> {
  const outlineString = convertOutlineToString(item);
  const prompt = buildPrompt(item, outlineString);

  let draft = "";
  let finalWordCount = 0;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_DRAFT_RETRIES; attempt++) {
    retries = attempt;
    const rawDraft = await generator(prompt);
    
    // Sanitize the response: LLMs sometimes include the prompt.
    draft = sanitizeDraft(rawDraft, prompt);
    finalWordCount = wordCount(draft);

    if (finalWordCount >= MIN_DRAFT_WORDS && finalWordCount <= MAX_DRAFT_WORDS) {
      break; // Word count is within the valid range
    }

    console.warn(
      `R3: Draft for "${item.idea}" (attempt ${attempt + 1}) did not meet word count requirements ` +
      `(${finalWordCount} words). Retrying...`
    );
  }

  // Final check after all retries
  if (finalWordCount < MIN_DRAFT_WORDS || finalWordCount > MAX_DRAFT_WORDS) {
    throw new Error(
      `Generated draft word count (${finalWordCount}) is outside the range ` +
      `${MIN_DRAFT_WORDS}-${MAX_DRAFT_WORDS} after ${MAX_DRAFT_RETRIES} retries.`
    );
  }

  const draftDoc: DraftDocument = {
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

  validateDraftDocument(draftDoc);
  return draftDoc;
}

// --- 5. API & UTILITY FUNCTIONS ---

/**
 * Makes a single call to the Hugging Face Inference API.
 */
export async function callHuggingFace(prompt: string): Promise<string> {
  const apiKey = env.hfToken;
  const modelId = env.hfModelR3;

  if (!apiKey || !modelId) {
    throw new Error("Hugging Face API key or model for R3 is not set in environment variables.");
  }

  const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 2048, temperature: 0.8 },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Hugging Face R3 API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = (await response.json()) as any;
  const generatedText = data?.[0]?.generated_text;

  if (typeof generatedText !== "string") {
    throw new Error("Invalid or missing \'generated_text\' in response from Hugging Face R3 API.");
  }

  return generatedText;
}

/** Simple word counter. */
export function wordCount(text: string): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

/** Removes the prompt from the start of the draft, if present. */
export function sanitizeDraft(draft: string, prompt: string): string {
  // Trim both to handle leading/trailing whitespace inconsistencies
  const trimmedDraft = draft.trim();
  const trimmedPrompt = prompt.trim();
  if (trimmedDraft.startsWith(trimmedPrompt)) {
    return trimmedDraft.substring(trimmedPrompt.length).trim();
  }
  return trimmedDraft;
}

// --- 6. VALIDATION & PROMPT ENGINEERING ---

/** Validates the structure of the R2 outlines. */
export function validateR2Outlines(items: any): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("R2 artifact has no \'items\' array or is empty.");
  }
  for (const item of items) {
    if (!item.trend || !item.idea || !Array.isArray(item.sections) || item.sections.length === 0) {
      throw new Error(`Invalid R2 OutlineItem: missing fields or empty sections. Item: ${JSON.stringify(item)}`);
    }
    for (const section of item.sections) {
      if (!section.heading || !Array.isArray(section.bullets)) {
        throw new Error(`Invalid section in outline for trend "${item.trend}". Section: ${JSON.stringify(section)}`);
      }
    }
  }
}

/** Validates the final generated DraftDocument. */
function validateDraftDocument(doc: DraftDocument): void {
  if (!doc.draft || doc.wordCount <= 0) {
    throw new Error(`Invalid draft generated for trend "${doc.trend}": empty draft or zero word count.`);
  }
  if (!doc.metadata.createdAt) {
    throw new Error(`Invalid draft generated for trend "${doc.trend}": missing createdAt timestamp.`);
  }
}

/** Converts a structured outline into a string for the prompt. */
export function convertOutlineToString(item: R2OutlineItem): string {
  return item.sections
    .map(s => `## ${s.heading}\n${s.bullets.map(b => `- ${b}`).join("\n")}`)
    .join("\n\n");
}

/** Constructs the prompt for the language model. */
export function buildPrompt(item: R2OutlineItem, outlineString: string): string {
  return `Write a long-form, engaging, coherent draft based on the following outline. Aim for between ${MIN_DRAFT_WORDS} and ${MAX_DRAFT_WORDS} words. Make the content useful and avoid empty output.

TREND: ${item.trend}
IDEA: ${item.idea}
OUTLINE:
${outlineString}

DRAFT:`;
}

// --- 7. MAIN ORCHESTRATION FUNCTION ---

/**
 * Main function for Round 3: generates drafts from R2 outlines in parallel.
 */
export async function Round3_Draft(
  runId: string
): Promise<{ draftsCreated: number; failures: number }> {
  try {
    console.log(`Starting Round 3: Draft Generation for runId=${runId}`);
    const outlines = await fetchR2Data(runId);

    const limit = pLimit(CONCURRENCY);
    let successes = 0;
    let failures = 0;

    const promises = outlines.map(outline =>
      limit(async () => {
        try {
          const draft = await generateDraftForOutline(outline, runId);
          successes++;
          return draft;
        } catch (error: any) {
          console.error(
            `R3: Failed to generate draft for idea "${outline.idea}" in runId=${runId}:`,
            error.message
          );
          failures++;
          return null; // Indicate failure
        }
      })
    );

    const results = await Promise.all(promises);
    const successfulDrafts = results.filter((d): d is DraftDocument => d !== null);

    await saveR3Drafts(runId, successfulDrafts);

    console.log(
      `Round 3 finished for runId=${runId}. ` +
      `Successes: ${successes}, Failures: ${failures}`
    );

    return { draftsCreated: successes, failures };
  } catch (err: any) {
    console.error(`Critical error in Round 3 for runId=${runId}:`, err.message);
    throw err; // Re-throw for the top-level handler
  }
}

// --- 8. EXPORTS FOR TESTING ---
export const _test = {
  buildPrompt,
  callHuggingFace,
  convertOutlineToString,
  generateDraftForOutline,
  sanitizeDraft,
  validateR2Outlines,
  wordCount,
};
