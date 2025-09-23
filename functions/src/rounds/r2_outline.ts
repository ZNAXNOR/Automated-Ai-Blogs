
import { getFirestore } from "firebase-admin/firestore";
import fetch from "node-fetch";
import { IdeationItem } from "../utils/schema";
import { env } from "../utils/config";

// --- 1. DATA MODELS ---
export interface OutlineSection {
  heading: string;
  bullets: string[];
  estWordCount: number;
}

export interface OutlineItem {
  trend: string;
  idea: string;
  sections: OutlineSection[];
}

// --- 2. CONFIGURATION ---
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// --- 3. I/O OPERATIONS ---

/**
 * Fetches and validates the Round 1 artifact from Firestore.
 * @param runId The ID of the current run.
 * @returns A promise that resolves to an array of ideation items.
 */
export async function fetchR1Data(runId: string): Promise<IdeationItem[]> {
  console.log(`R2: Fetching R1 data for runId=${runId}`);
  const db = getFirestore();
  const r1Snap = await db.doc(`runs/${runId}/artifacts/round1`).get();

  if (!r1Snap.exists) {
    throw new Error(`R1 artifact not found for runId=${runId}`);
  }

  const data = r1Snap.data();
  const items = data?.items as IdeationItem[];

  validateIdeationItems(items);
  console.log(`R2: Fetched and validated ${items.length} ideas from R1.`);
  return items;
}

/**
 * Saves the generated outlines for Round 2 to Firestore.
 * @param runId The ID of the current run.
 * @param outlines An array of outline items to save.
 */
export async function saveR2Outlines(
  runId: string,
  outlines: OutlineItem[]
): Promise<void> {
  console.log(`R2: Saving ${outlines.length} outlines to Firestore for runId=${runId}`);
  const db = getFirestore();
  await db.doc(`runs/${runId}/artifacts/round2`).set(
    {
      items: outlines,
    },
    { merge: true }
  );
  console.log(`R2: Successfully saved outlines.`);
}

// --- 4. CORE LOGIC ---

/**
 * Generates article outlines based on a list of ideas.
 * @param items An array of ideation items from Round 1.
 * @returns A promise that resolves to an array of outline items.
 */
async function generateOutlines(items: IdeationItem[]): Promise<OutlineItem[]> {
  console.log(`R2: Generating outlines for ${items.length} ideas.`);
  const prompt = buildPrompt(items);
  const rawText = await callHuggingFaceWithRetry(prompt);
  const jsonText = extractJsonFromText(rawText);

  if (!jsonText) {
    console.error(`R2 JSON extraction failed. Raw output:`, rawText);
    throw new Error("No valid JSON found in model response");
  }

  const outlines = JSON.parse(jsonText) as OutlineItem[];
  validateOutlineSchema(outlines);

  console.log(`R2: Hugging Face returned and validated ${outlines.length} outlines.`);
  return outlines;
}

// --- 5. API & UTILITY FUNCTIONS ---

/**
 * Calls the Hugging Face API with a retry mechanism.
 * @param prompt The prompt to send to the language model.
 * @returns A promise that resolves to the raw text response from the model.
 */
async function callHuggingFaceWithRetry(prompt: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callHuggingFace(prompt);
    } catch (error: any) {
      console.warn(`R2: Hugging Face API call attempt ${attempt} failed: ${error.message}`);
      if (attempt === MAX_RETRIES) {
        console.error("R2: All retry attempts failed.");
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  // This line should be unreachable
  throw new Error("Exhausted all retries for Hugging Face API.");
}

/**
 * Makes a single call to the Hugging Face Inference API.
 * @param prompt The prompt to send.
 * @returns The 'generated_text' from the response.
 */
async function callHuggingFace(prompt: string): Promise<string> {
  const apiKey = env.hfToken;
  const modelId = env.hfModelR2;

  if (!apiKey || !modelId) {
    throw new Error("Hugging Face API key or model is not set in environment variables.");
  }

  console.log("R2: Calling Hugging Face API...");
  const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 4096 } }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Hugging Face API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = (await response.json()) as any[];
  const generatedText = data?.[0]?.generated_text;

  if (typeof generatedText !== "string") {
    console.error("R2: Invalid response structure from Hugging Face:", data);
    throw new Error("Invalid or missing 'generated_text' in response from Hugging Face API.");
  }

  return generatedText;
}

// --- 6. VALIDATION & PROMPT ENGINEERING ---

/**
 * Validates the structure and content of the R1 ideation items.
 * @param items The items to validate.
 */
function validateIdeationItems(items: any): void {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("R1 artifact has no 'items' array or is empty.");
  }
  for (const item of items) {
    if (!item.trend || !item.idea || item.variant === undefined || !item.source) {
      throw new Error(`Invalid IdeationItem in R1 artifact: ${JSON.stringify(item)}`);
    }
  }
}

/**
 * Validates the schema of the outlines generated by the LLM.
 * @param outlines The outlines to validate.
 */
function validateOutlineSchema(outlines: any): void {
  if (!Array.isArray(outlines)) {
    throw new Error("R2 LLM output is not a valid JSON array.");
  }
  for (const outline of outlines) {
    if (!outline.trend || !outline.idea || !Array.isArray(outline.sections)) {
      throw new Error(`Invalid outline format: missing required fields. Found: ${JSON.stringify(outline)}`);
    }
    for (const section of outline.sections) {
      if (!section.heading || !Array.isArray(section.bullets) || section.estWordCount === undefined) {
        throw new Error(`Invalid section format in outline: ${JSON.stringify(section)}`);
      }
    }
  }
}

/**
 * Constructs the prompt for the language model.
 * @param items An array of ideation items.
 * @returns A string representing the full prompt.
 */
export function buildPrompt(items: IdeationItem[]): string {
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
              "Brief overview of AI's growing role in medicine.",
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

/**
 * Extracts a JSON array from a raw text string.
 * @param text The text to parse.
 * @returns The extracted JSON string, or null if not found.
 */
export function extractJsonFromText(text: string): string | null {
  const match = text.match(/(\[[\s\S]*\])/);
  return match ? match[0] : null;
}

// --- 7. MAIN ORCHESTRATION FUNCTION ---

/**
 * Main function for Round 2: generates outlines from R1 ideas.
 * @param runId The ID of the current run.
 */
export async function Round2_Outline(runId: string): Promise<void> {
  try {
    console.log(`Starting Round 2: Outline Generation for runId=${runId}`);
    const ideationItems = await fetchR1Data(runId);
    const outlines = await generateOutlines(ideationItems);
    await saveR2Outlines(runId, outlines);
    console.log(`Round 2 completed successfully for runId=${runId}.`);
  } catch (err: any) {
    console.error(`Error in Round 2 for runId=${runId}:`, err.message);
    throw err; // Re-throw for the caller
  }
}

// --- 8. EXPORTS FOR TESTING ---
export const _test = {
  buildPrompt,
  extractJsonFromText,
  callHuggingFace,
  validateIdeationItems,
  validateOutlineSchema,
};
