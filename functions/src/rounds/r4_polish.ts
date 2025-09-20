/**
 * Round 4: Polish & Derive
 *
 * This round takes the raw drafts from Round 3, uses an LLM to polish the text,
 * and generates several derivative content formats (e.g., social media posts, email snippets).
 *
 * Key Improvements:
 * - Standardized I/O to read from R3 artifacts and write to R4 artifacts.
 * - Parallel processing of drafts for performance.
 * - Stricter, schema-based validation for inputs and outputs.
 * - Robust JSON extraction from LLM responses.
 * - Centralized configuration and enhanced logging.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fetch from "node-fetch";
import pLimit from "p-limit";
import { env } from "../utils/config";

// --- 1. DATA MODELS ---

// Input from Round 3
export interface R3DraftDocument {
  runId: string;
  trend: string;
  idea: string;
  draft: string;
  wordCount: number;
}

// The expected structure of the JSON output from the LLM
export interface LLMResponse {
  polished: string;
  derivatives: string[];
}

// The final artifact for this round
export interface R4PolishedItem {
  runId: string;
  trend: string;
  idea: string;
  originalDraft: string;
  polished: string;
  derivatives: string[];
  metadata: {
    createdAt: number; // epoch ms
    originalWordCount: number;
    polishedWordCount: number;
    polishVersion: string; // To track pipeline changes
    derivativeCount: number;
  };
}

export interface FailedDraft {
    draft: R3DraftDocument;
    error: string;
    timestamp: number;
  }

// --- 2. CONFIGURATION ---
const CONCURRENCY = 5;
const POLISH_VERSION = "v1.1";
const RETRIES = 2;
const DRAFT_TIMEOUT = 30000; // 30 seconds

// --- 3. I/O OPERATIONS ---

/**
 * Fetches and validates the Round 3 artifact from Firestore.
 */
export async function fetchR3Data(runId: string, db = getFirestore()): Promise<R3DraftDocument[]> {
    console.log(JSON.stringify({ level: 'info', runId, step: 'R4_fetchR3Data', msg: 'Fetching R3 data' }));
  const r3Snap = await db.doc(`runs/${runId}/artifacts/round3`).get();

  if (!r3Snap.exists) {
    throw new Error(`R3 artifact not found for runId=${runId}`);
  }

  const items = r3Snap.data()?.items as R3DraftDocument[];
  validateR3Drafts(items);

  console.log(JSON.stringify({ level: 'info', runId, step: 'R4_fetchR3Data', msg: `Fetched and validated ${items.length} drafts from R3.` }));
  return items;
}

/**
 * Saves the polished items for Round 4 to a single artifact and a distribution collection in Firestore.
 */
export async function saveR4Polish(
  runId: string,
  polishedItems: R4PolishedItem[],
  failedItems: FailedDraft[],
  db = getFirestore(),
): Promise<void> {
  if (polishedItems.length === 0 && failedItems.length === 0) {
    console.log(JSON.stringify({ level: 'info', runId, step: 'R4_saveR4Polish', msg: 'No polished or failed items to save.' }));
    return;
  }

  console.log(JSON.stringify({ level: 'info', runId, step: 'R4_saveR4Polish', msg: `Saving ${polishedItems.length} polished items and ${failedItems.length} failures to Firestore` }));

  const batch = db.batch();

  if (polishedItems.length > 0) {
    const successRef = db.doc(`runs/${runId}/artifacts/round4`);
    batch.set(successRef, {
      items: polishedItems,
      createdAt: FieldValue.serverTimestamp(),
    });

    const distributionCollection = db.collection(`runs/${runId}/artifacts/round4_distribution`);
    polishedItems.forEach(item => {
        const docRef = distributionCollection.doc(); // Auto-generate ID
        batch.set(docRef, item);
    });
  }

  if (failedItems.length > 0) {
    const failureRef = db.doc(`runs/${runId}/artifacts/round4_failures`);
    batch.set(failureRef, {
      items: failedItems,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(JSON.stringify({ level: 'info', runId, step: 'R4_saveR4Polish', msg: 'Successfully saved artifacts.' }));
}

// --- 4. CORE LOGIC ---

/**
 * Processes a single draft: builds prompt, calls LLM, validates, and returns a polished item.
 */
export async function processSingleDraft(
  draftDoc: R3DraftDocument,
  llmApiCall: (prompt: string) => Promise<string> = callHuggingFace
): Promise<R4PolishedItem> {
  const prompt = buildPrompt(draftDoc.draft);

  let llmResponse = "";
  for (let i = 0; i <= RETRIES; i++) {
    try {
        llmResponse = await Promise.race([
            llmApiCall(prompt),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('LLM call timed out')), DRAFT_TIMEOUT))
        ]);
        break; // Success
    } catch (error: any) {
        if (i === RETRIES) {
            throw new Error(`LLM call failed after ${RETRIES} retries: ${error.message}`);
        }
    }
  }

  const parsedJson = extractJsonFromText(llmResponse);
  if (!parsedJson) {
    throw new Error(`No valid JSON object found in LLM response. Raw: ${llmResponse}`);
  }

  const llmOutput = JSON.parse(parsedJson) as LLMResponse;
  validateLlmResponse(llmOutput);

  const polishedItem: R4PolishedItem = {
    runId: draftDoc.runId,
    trend: draftDoc.trend,
    idea: draftDoc.idea,
    originalDraft: draftDoc.draft,
    polished: llmOutput.polished,
    derivatives: llmOutput.derivatives,
    metadata: {
      createdAt: Date.now(),
      originalWordCount: draftDoc.wordCount,
      polishedWordCount: wordCount(llmOutput.polished),
      polishVersion: POLISH_VERSION,
      derivativeCount: llmOutput.derivatives.length,
    },
  };

  return polishedItem;
}

// --- 5. API & UTILITY FUNCTIONS ---

/**
 * Calls the Hugging Face API.
 */
export async function callHuggingFace(prompt: string): Promise<string> {
  const apiKey = env.hfToken;
  const modelId = env.hfModelR4;

  if (!apiKey || !modelId) {
    throw new Error("Hugging Face API key or model for R4 is not set.");
  }

  const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 1024 } }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Hugging Face R4 API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = (await response.json()) as any;
  const generatedText = data?.[0]?.generated_text;

  if (typeof generatedText !== "string") {
    throw new Error("Invalid or missing 'generated_text' in response from Hugging Face R4 API.");
  }

  return generatedText;
}

/** 
 * Extracts a JSON object from a raw text string, tolerant of markdown code blocks. 
 */
export function extractJsonFromText(text: string): string | null {
    // First, try to find a JSON block wrapped in markdown
    const markdownMatch = text.match(/```json\\n([\s\S]*?)\n```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1];
    }

    // Fallback to the original regex for standalone JSON
    const match = text.match(/\{([^{}]|\{[^{}]*\})*\}/);
    return match ? match[0] : null;
}

/** Simple word counter. */
export function wordCount(text: string): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

// --- 6. VALIDATION & PROMPT ENGINEERING ---

/** Validates the structure of the R3 drafts. */
export function validateR3Drafts(items: any): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("R3 artifact has no 'items' array or is empty.");
  }
  for (const item of items) {
    if (!item.runId || !item.trend || !item.idea || !item.draft || !item.wordCount) {
      throw new Error(`Invalid R3 DraftDocument: missing required fields. Item: ${JSON.stringify(item)}`);
    }
  }
}

/** Validates the JSON structure returned by the LLM. */
export function validateLlmResponse(data: any): void {
  if (typeof data.polished !== 'string' || data.polished.length < 20) {
    throw new Error(`LLM response validation failed: 'polished' is not a string or is too short. Found: ${data.polished}`);
  }
  if (!Array.isArray(data.derivatives) || data.derivatives.length < 2) {
    throw new Error(`LLM response validation failed: 'derivatives' must be an array with at least 2 items. Found: ${data.derivatives?.length}`);
  }
  for(const derivative of data.derivatives) {
      if(typeof derivative !== 'string' || derivative.trim() === '') {
          throw new Error(`LLM response validation failed: a derivative is not a non-empty string.`);
      }
  }
}

/** Constructs the prompt for the language model. */
export function buildPrompt(draftText: string): string {
  return `
System: You are a professional content editor. You will refine a draft blog post into polished, human-readable text of at least 100 words. Then, you will create a minimum of two relevant distribution formats (like social media posts, email snippets, or tweet threads). Where suitable, embed inline suggestions for images like [image: a photo of a robot writing at a desk].

Your output must be a single, valid JSON object with the following structure: {"polished": "...", "derivatives": ["...", "..."]}. Do not include any text before or after the JSON object.

User: Here is the draft blog post. Please polish it and generate the derivatives.

Draft:
${draftText.trim()}
`;
}

// --- 7. MAIN ORCHESTRATION FUNCTION ---

/**
 * Main function for Round 4: polishes and creates derivatives from R3 drafts.
 */
export async function Round4_Polish(
  runId: string,
  dependencies: {
    llmApiCall?: (prompt: string) => Promise<string>;
    firestore?: any,
  } = {}
): Promise<{ polishedCount: number; failures: number }> {
  try {
    const db = dependencies.firestore || getFirestore();
    console.log(JSON.stringify({ level: 'info', runId, step: 'R4_start', msg: `Starting Round 4: Polish & Derive` }));
    const drafts = await fetchR3Data(runId, db);

    const limit = pLimit(CONCURRENCY);
    const failedItems: FailedDraft[] = [];

    const promises = drafts.map(draft =>
      limit(async () => {
        try {
          const polishedItem = await processSingleDraft(draft, dependencies.llmApiCall);
          return polishedItem;
        } catch (error: any) {
            console.error(JSON.stringify({ level: 'error', runId, idea: draft.idea, msg: `Failed to polish draft: ${error.message}` }));
            failedItems.push({ draft, error: error.message, timestamp: Date.now() });
          return null; // Indicate failure
        }
      })
    );

    const results = await Promise.all(promises);
    const successfulItems = results.filter((item): item is R4PolishedItem => item !== null);

    await saveR4Polish(runId, successfulItems, failedItems, db);

    console.log(JSON.stringify({ level: 'info', runId, step: 'R4_finish', msg: `Round 4 finished. Successes: ${successfulItems.length}, Failures: ${failedItems.length}` }));


    return { polishedCount: successfulItems.length, failures: failedItems.length };
  } catch (err: any) {
    console.error(JSON.stringify({ level: 'critical', runId, step: 'R4_main_error', msg: err.message }));
    throw err; // Re-throw for the top-level handler
  }
}

// --- 8. EXPORTS FOR TESTING ---
export const _test = {
  buildPrompt,
  callHuggingFace,
  extractJsonFromText,
  processSingleDraft,
  validateR3Drafts,
  validateLlmResponse,
};
