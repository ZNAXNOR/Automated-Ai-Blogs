/**
 * src/rounds/r1_ideation.ts
 *
 * Round 1: Topic Ideation
 *
 * - Reads trends from: runs/{runId}/artifacts/round0  (expects a document with a `trends` array of TrendItem)
 * - Calls Hugging Face (TinyLlama) using the structured prompt provided
 * - Parses JSON output into IdeationItem[]
 * - Writes result to: runs/{runId}/artifacts/round1 (single doc, field `items`)
 *
 * Environment variables:
 * - HUGGINGFACE_API_KEY  (required)
 * - HUGGINGFACE_MODEL    (optional; default must be provided by your deployment; recommended to set)
 */

import admin from "firebase-admin";
import fetch from "node-fetch";

type TrendItem = {
  query: string;
  type: string; // "autocomplete" | "related" | "trend"
  sourceName: string;
};

type IdeationItem = {
  trend: string; // original query
  idea: string; // proposed blog title
  variant: number; // 1..5
  source: "llm";
};

const MAX_IDEAS_PER_TREND = 5;
const MIN_IDEAS_PER_TREND = 3;
const MAX_TOTAL_IDEAS = 60;

// Initialize Firebase Admin if necessary
if (!admin.apps.length) {
  // If the runtime has GOOGLE_APPLICATION_CREDENTIALS or automatic environment service account,
  // admin.initializeApp() will work. Adjust as needed for your environment.
  admin.initializeApp();
}

/**
 * Build the exact prompt requested by the user.
 * It expects an input: list of trend strings.
 */
function buildPrompt(trendQueries: string[]): string {
  // Use the exact structured prompt per user's instructions
  const prompt = `You are an expert blog strategist helping select article titles from trending topics.

TASK:
- For each input trend, generate 3–5 unique, creative blog title ideas.
- Titles should be short (≤12 words), clear, and engaging.
- Focus on human readability and search-friendliness.
- Avoid clickbait and repetition.

OUTPUT FORMAT (strict JSON only):
[
  {
    "trend": "<trend string>",
    "ideas": ["<title1>", "<title2>", "<title3>"]
  },
  ...
]

EXAMPLE:
Input: ["AI in healthcare"]
Output:
[
  {
    "trend": "AI in healthcare",
    "ideas": [
      "How AI is Transforming Healthcare in 2025",
      "AI in Hospitals: Benefits and Challenges",
      "The Future of Medicine with Artificial Intelligence"
    ]
  }
]

Input: ${JSON.stringify(trendQueries)}
`;
  return prompt;
}

/**
 * Call Hugging Face inference API (text input) and return the raw string output.
 */
async function callHuggingFace(prompt: string): Promise<string> {
  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  const HF_MODEL = process.env.HUGGINGFACE_MODEL || "<set-your-model-slug-here>";

  if (!HF_API_KEY) {
    throw new Error("HUGGINGFACE_API_KEY environment variable is not set.");
  }
  if (!HF_MODEL || HF_MODEL.includes("<set-your-model")) {
    throw new Error("HUGGINGFACE_MODEL environment variable is not set to a valid model slug.");
  }

  const HF_ENDPOINT = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

  const payload = {
    inputs: prompt,
    parameters: {
      // small controls; tune in production
      max_new_tokens: 512,
      return_full_text: true,
      // guardrails for safety might be applied here
    },
  };

  const res = await fetch(HF_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hugging Face API error: ${res.status} ${res.statusText} - ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  // HF inference sometimes returns JSON with { "generated_text": "..." } or other shapes
  const raw = await res.text();

  // If it's JSON and contains generated_text, extract it
  try {
    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(raw);
      // If model returned array or object from HF, handle common shapes:
      if (Array.isArray(parsed)) {
        // e.g. [{generated_text: "..."}]
        const first = parsed[0];
        if (first && typeof first === "object" && "generated_text" in first) {
          return String(first.generated_text);
        }
      } else if (parsed && typeof parsed === "object" && "generated_text" in parsed) {
        return String((parsed as any).generated_text);
      }
      // else fallback to raw string text
      return raw;
    } else {
      return raw;
    }
  } catch (err) {
    // fallback to raw text
    return raw;
  }
}

/**
 * Extract the first JSON array from a string and parse it.
 * This is defensive: the model was requested to return strict JSON, but many servers
 * may wrap or add pre/post text. We look for a top-level JSON array and parse.
 */
function extractJsonArray(text: string): any[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON array found in model output.");
  }
  const jsonStr = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error("Extracted JSON is not an array.");
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse JSON extracted from model output: ${(err as Error).message}`);
  }
}

/**
 * Validate and normalize the parsed LLM output into IdeationItem[].
 */
function mapToIdeationItems(parsed: any[]): IdeationItem[] {
  const items: IdeationItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const trend = String(entry.trend ?? "").trim();
    const ideas = Array.isArray(entry.ideas) ? entry.ideas : [];

    if (!trend) continue;
    // ensure at least MIN_IDEAS_PER_TREND by padding (but ideally LLM gives enough)
    const cleanedIdeas = ideas
      .map((s: any) => String(s ?? "").trim())
      .filter((s: string) => s.length > 0)
      .slice(0, MAX_IDEAS_PER_TREND);

    // skip trends with too few ideas
    if (cleanedIdeas.length < MIN_IDEAS_PER_TREND) {
      // Skip; alternatively you could throw or fallback - choose skip to be robust
      continue;
    }

    cleanedIdeas.forEach((idea: string, idx: number) => {
      items.push({
        trend,
        idea,
        variant: idx + 1,
        source: "llm",
      });
    });
  }

  // enforce total ideas <= MAX_TOTAL_IDEAS, trimming from the end
  if (items.length > MAX_TOTAL_IDEAS) {
    items.splice(MAX_TOTAL_IDEAS);
  }

  // final safety: no empty strings
  return items.filter((it) => it.idea.trim().length > 0);
}

/**
 * Main exported function to run round1.
 * Reads round0 artifact, calls LLM, writes round1 artifact.
 */
export async function runRound1(runId: string): Promise<{ wrote: number }> {
  if (!runId) throw new Error("runId is required");

  const db = admin.firestore();

  // Read round0 artifact
  const r0DocRef = db.collection("runs").doc(runId).collection("artifacts").doc("round0");
  const r0Snap = await r0DocRef.get();
  if (!r0Snap.exists) {
    throw new Error(`Round0 artifact not found for runId=${runId} at runs/${runId}/artifacts/round0`);
  }

  const r0Data = r0Snap.data() || {};
  // expected shape: { trends: TrendItem[] } or maybe the tests use another field; be tolerant:
  const trendsFromDoc: TrendItem[] =
    (Array.isArray(r0Data.trends) && r0Data.trends) ||
    (Array.isArray((r0Data as any).items) && (r0Data as any).items) ||
    [];

  if (!Array.isArray(trendsFromDoc) || trendsFromDoc.length === 0) {
    throw new Error(`No trends found in round0 artifact for runId=${runId}`);
  }

  // build input list of trend strings (unique, limit 12)
  const trendQueries = Array.from(
    new Set(trendsFromDoc.map((t) => String(t.query ?? "").trim()).filter((s) => s.length > 0))
  ).slice(0, 12);

  if (trendQueries.length === 0) {
    throw new Error("After normalization, no valid trend queries were found.");
  }

  const prompt = buildPrompt(trendQueries);

  const hfRaw = await callHuggingFace(prompt);

  // Attempt to extract JSON array
  const parsed = extractJsonArray(hfRaw);

  const ideationItems = mapToIdeationItems(parsed);

  if (ideationItems.length === 0) {
    throw new Error("No valid ideation items produced by LLM.");
  }

  // Basic test requirement: every trend from R0 should produce >= 3 ideas.
  // We'll check and if any original trend is missing or insufficient, throw.
  const trendsMap = new Map<string, number>();
  for (const it of ideationItems) {
    trendsMap.set(it.trend, (trendsMap.get(it.trend) || 0) + 1);
  }

  for (const t of trendQueries) {
    const count = trendsMap.get(t) || 0;
    if (count < MIN_IDEAS_PER_TREND) {
      throw new Error(`Trend "${t}" produced fewer than ${MIN_IDEAS_PER_TREND} ideas (${count}).`);
    }
  }

  // Write to Firestore at runs/{runId}/artifacts/round1
  const r1DocRef = db.collection("runs").doc(runId).collection("artifacts").doc("round1");
  await r1DocRef.set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    items: ideationItems,
  });

  return { wrote: ideationItems.length };
}

export { TrendItem, IdeationItem };