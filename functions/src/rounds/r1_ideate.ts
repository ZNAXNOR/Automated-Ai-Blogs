
import admin from "firebase-admin";
import fetch from "node-fetch";
import { env } from "../utils/config";

type TrendItem = {
  query: string;
  type: string; 
  sourceName: string;
};

type IdeationItem = {
  trend: string; 
  idea: string; 
  variant: number; 
  source: "llm";
};

const MAX_IDEAS_PER_TREND = 5;
const MIN_IDEAS_PER_TREND = 3;
const MAX_TOTAL_IDEAS = 60;

if (!admin.apps.length) {
  admin.initializeApp();
}

function buildPrompt(trendQueries: string[]): string {
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

async function callHuggingFace(prompt: string): Promise<string> {
  const hfToken = env.hfToken;
  const HF_MODEL = env.hfModelR1;

  if (!hfToken) {
    throw new Error("HF_TOKEN environment variable is not set.");
  }
  if (!HF_MODEL || HF_MODEL.includes("<set-your-model")) {
    throw new Error("HUGGINGFACE_MODEL environment variable is not set to a valid model slug.");
  }

  const HF_ENDPOINT = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

  const payload = {
    inputs: prompt,
    parameters: {
      max_new_tokens: 512,
      return_full_text: true,
    },
  };

  const res = await fetch(HF_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
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
  const raw = await res.text();

  try {
    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const first = parsed[0];
        if (first && typeof first === "object" && "generated_text" in first) {
          return String(first.generated_text);
        }
      } else if (parsed && typeof parsed === "object" && "generated_text" in parsed) {
        return String((parsed as any).generated_text);
      }
      return raw;
    } else {
      return raw;
    }
  } catch (err) {
    return raw;
  }
}

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

function mapToIdeationItems(parsed: any[]): IdeationItem[] {
  const items: IdeationItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const trend = String(entry.trend ?? "").trim();
    const ideas = Array.isArray(entry.ideas) ? entry.ideas : [];

    if (!trend) continue;
    const cleanedIdeas = ideas
      .map((s: any) => String(s ?? "").trim())
      .filter((s: string) => s.length > 0)
      .slice(0, MAX_IDEAS_PER_TREND);

    if (cleanedIdeas.length < MIN_IDEAS_PER_TREND) {
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

  if (items.length > MAX_TOTAL_IDEAS) {
    items.splice(MAX_TOTAL_IDEAS);
  }

  return items.filter((it) => it.idea.trim().length > 0);
}

export async function Round1_Ideate(runId: string): Promise<{ wrote: number }> {
  if (!runId) throw new Error("runId is required");

  const db = admin.firestore();

  const r0DocRef = db.collection("runs").doc(runId).collection("artifacts").doc("round0");
  const r0Snap = await r0DocRef.get();
  if (!r0Snap.exists) {
    throw new Error(`Round0 artifact not found for runId=${runId} at runs/${runId}/artifacts/round0`);
  }

  const r0Data = r0Snap.data() || {};
  const trendsFromDoc: TrendItem[] =
    (Array.isArray(r0Data.trends) && r0Data.trends) ||
    (Array.isArray((r0Data as any).items) && (r0Data as any).items) ||
    [];

  if (!Array.isArray(trendsFromDoc) || trendsFromDoc.length === 0) {
    throw new Error(`No trends found in round0 artifact for runId=${runId}`);
  }

  const trendQueries = Array.from(
    new Set(trendsFromDoc.map((t) => String(t.query ?? "").trim()).filter((s) => s.length > 0))
  ).slice(0, 12);

  if (trendQueries.length === 0) {
    throw new Error("After normalization, no valid trend queries were found.");
  }

  const prompt = buildPrompt(trendQueries);

  const hfRaw = await callHuggingFace(prompt);

  const parsed = extractJsonArray(hfRaw);

  const ideationItems = mapToIdeationItems(parsed);

  if (ideationItems.length === 0) {
    throw new Error("No valid ideation items produced by LLM.");
  }

  const trendsMap = new Map<string, number>();
  for (const it of ideationItems) {
    trendsMap.set(it.trend, (trendsMap.get(it.trend) || 0) + 1);
  }

  for (const t of trendQueries) {
    const count = trendsMap.get(t) || 0;
    if (count < MIN_IDEAS_PER_TREND) {
      throw new Error(`Trend \"${t}\" produced fewer than ${MIN_IDEAS_PER_TREND} ideas (${count}).`);
    }
  }

  const r1DocRef = db.collection("runs").doc(runId).collection("artifacts").doc("round1");
  await r1DocRef.set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    items: ideationItems,
  });

  return { wrote: ideationItems.length };
}

export { TrendItem, IdeationItem };
