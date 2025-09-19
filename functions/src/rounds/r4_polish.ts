/**
 * - Takes Round 3 drafts
 * - Produces polished text and distribution-ready derivatives
 * - Stores results in Firestore collection: round4_distribution
 */

import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../utils/config";
import fetch from "node-fetch";

function buildPrompt(draftText: string): string {
  return `
System: You are a professional content strategist. 
You refine draft blog sections into polished, human-readable text, then decide the most effective distribution formats (social posts, email snippets, LinkedIn blurbs, tweet threads, etc.). 
Where suitable, embed inline suggestions for memes, screenshots, artwork, or other images. 
If no distribution formats apply, skip them. 
Always prioritize clarity and reader engagement.
You must output in a valid JSON format, with the following structure: {"polished": "...", "derivatives": ["...", "..."]}.

User: Here is a draft blog section. 
1. First, polish the tone and readability. 
2. Then, generate relevant distribution outputs (skip if none apply). 
3. Where helpful, insert inline image suggestions.

Draft:
${draftText}
`;
}

async function callHuggingFace(prompt: string): Promise<{ polished: string; derivatives: string[] }> {
    const HF_API_URL = `https://api-inference.huggingface.co/models/${env.hfModelR4}`;

    const response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.HF_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 1024,
                temperature: 0.7,
                return_full_text: false,
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
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("No JSON found in model response:", text);
            throw new Error("Failed to parse JSON from model: No JSON found");
        }
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
    } catch (err) {
        console.error("Failed to parse JSON from model:", text);
        throw err;
    }
}


async function runR4Polish(draftId: string, draftText: string) {
  if (!draftId || !draftText) {
    throw new Error("Missing required fields: draftId, draftText");
  }
  
  const db = getFirestore();

  const prompt = buildPrompt(draftText);

  // Call LLM
  const { polished, derivatives } = await callHuggingFace(prompt);

  // Validation rules
  if (!polished || polished.trim().length === 0) {
    throw new Error("Polished text is empty");
  }
  if (derivatives.length < 2) {
    throw new Error("Each draft must produce ≥ 2 derivative outputs");
  }
  if (derivatives.length > 100) {
    throw new Error("Too many derivative outputs (limit = 100)");
  }
  for (const d of derivatives) {
    if (!d || d.trim().length === 0) {
      throw new Error("Derivative output is empty");
    }
  }

  // Save to Firestore
  const docRef = db.collection("round4_distribution").doc(draftId);
  await docRef.set({
    draftId,
    polished,
    derivatives,
    createdAt: new Date().toISOString(),
  });

  return { draftId, polished, derivatives };
}


export const r4_distribution = onCall(
  { timeoutSeconds: 300, memory: "1GiB" },
  async (request) => {
    const { draftId, draftText } = request.data;
    return runR4Polish(draftId, draftText);
  }
);

// Export for testing
export const _test = {
    buildPrompt,
    runR4Polish
};
