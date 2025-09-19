/**
 * - Takes Round 4 polished text and derivatives
 * - Assesses relevance of the polished text against the original draft
 * - Stores results in Firestore collection: round5_relevance
 */

import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../utils/config";
import fetch from "node-fetch";

function buildPrompt(originalDraft: string, polishedText: string): string {
  return `
System: You are a content marketing analyst. Your task is to evaluate whether a polished text, derived from an original draft, remains true to the core message and intent of the original. 
If the polished text is a relevant and faithful adaptation, respond with {"isRelevant": true, "reason": "The polished text successfully captures the essence of the original draft."}. 
If it deviates significantly, respond with {"isRelevant": false, "reason": "[Explain the specific discrepancy]".

User: Here is the original draft and the polished text.

Original Draft:
${originalDraft}

Polished Text:
${polishedText}
`;
}

async function callHuggingFace(prompt: string): Promise<{ isRelevant: boolean; reason: string }> {
    const HF_API_URL = `https://api-inference.huggingface.co/models/${env.hfModelR5}`;

    const response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.HF_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 256,
                temperature: 0.5,
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

async function runR5Relevance(draftId: string, originalDraft: string, polishedText: string) {
  if (!draftId || !originalDraft || !polishedText) {
    throw new Error("Missing required fields: draftId, originalDraft, polishedText");
  }
  
  const db = getFirestore();

  const prompt = buildPrompt(originalDraft, polishedText);

  // Call LLM
  const { isRelevant, reason } = await callHuggingFace(prompt);

  // Save to Firestore
  const docRef = db.collection("round5_relevance").doc(draftId);
  await docRef.set({
    draftId,
    isRelevant,
    reason,
    createdAt: new Date().toISOString(),
  });

  return { draftId, isRelevant, reason };
}

export const r5_relevance = onCall(
  { timeoutSeconds: 300, memory: "1GiB" },
  async (request) => {
    const { draftId, originalDraft, polishedText } = request.data;
    return runR5Relevance(draftId, originalDraft, polishedText);
  }
);

// Export for testing
export const _test = {
    buildPrompt,
    runR5Relevance
};
