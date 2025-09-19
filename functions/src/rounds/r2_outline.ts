/**
 * Reads R1 artifact (ideation), generates structured outlines per idea
 * using Hugging Face, and saves results back to Firestore.
 */

import { getFirestore } from "firebase-admin/firestore";
import fetch from "node-fetch";
import { env } from "../utils/config";

// ---- Types ----

export interface IdeationItem {
  trend: string;
  idea: string;
  variant: number;
  source: "llm";
}

export interface OutlineItem {
  trend: string;
  idea: string;
  sections: {
    heading: string;
    bullets: string[];
    estWordCount: number;
  }[];
}

// ---- Prompt Template ----

function buildPrompt(ideas: IdeationItem[]): string {
  return `
You are a professional blog content planner.

TASK:
- Create a compact blog post outline for each input idea.
- Include 3–6 sections.
- Each section should have:
  - A clear heading
  - 2–3 bullet points
  - An estimated word count (50–150 words)
- Keep outlines logical, engaging, and suitable for SEO.

OUTPUT FORMAT (strict JSON only):
[
  {
    "trend": "<trend string>",
    "idea": "<headline string>",
    "sections": [
      {
        "heading": "<section heading>",
        "bullets": ["<point1>", "<point2>", "<point3>"],
        "estWordCount": 120
      }
    ]
  }
]

Input Ideas:
${JSON.stringify(ideas, null, 2)}
  `.trim();
}

// ---- Model Call ----

async function callHuggingFace(prompt: string): Promise<OutlineItem[]> {
  const HF_API_URL = `https://api-inference.huggingface.co/models/${env.hfModelR2}`;

  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 800,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HF API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;

  let text: string;
  if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
    text = data[0].generated_text;
  } else if (typeof data === "object" && data.generated_text) {
    text = data.generated_text;
  } else {
    text = JSON.stringify(data);
  }

  try {
    const parsed = JSON.parse(text);
    return parsed as OutlineItem[];
  } catch (err) {
    console.error("Failed to parse JSON from model:", text);
    throw err;
  }
}

// ---- Main Runner ----

export async function runRound2Outline(runId: string): Promise<OutlineItem[]> {
  const db = getFirestore();

  // 1. Read ideation artifact (Round 1)
  const r1Snap = await db
    .doc(`runs/${runId}/artifacts/round1`)
    .get();
  if (!r1Snap.exists) {
    throw new Error(`Round1 artifact not found for runId=${runId}`);
  }

  const r1Data = r1Snap.data() || {};
  const items: IdeationItem[] = r1Data.items || [];
  if (items.length === 0) {
    throw new Error(`No ideas found in Round1 artifact for runId=${runId}`);
  }

  // 2. Build prompt
  const prompt = buildPrompt(items);

  // 3. Call Model
  const outlines = await callHuggingFace(prompt);

  // 4. Save to Firestore
  await db
    .doc(`runs/${runId}/artifacts/round2`)
    .set({ items: outlines }, { merge: true });

  return outlines;
}

// Expose helpers for testing
export const _test = {
  buildPrompt,
  callHuggingFace,
};
