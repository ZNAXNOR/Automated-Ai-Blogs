/**
 * - Takes Round 4 polished text and derivatives
 * - Assesses coherence of the polished text against the derivatives
 * - Stores results in Firestore collection: round6_coherence
 */

import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../utils/config";
import fetch from "node-fetch";

async function callHuggingFace(text: string, textsToCompare: string[]): Promise<number[]> {
    const HF_API_URL = `https://api-inference.huggingface.co/models/${env.hfModelR6}`;

    const response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.HF_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: {
                source_sentence: text,
                sentences: textsToCompare,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`HF API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return data;
}

async function runR6Coherence(draftId: string, polishedText: string, derivatives: string[]) {
  if (!draftId || !polishedText || !derivatives || derivatives.length === 0) {
    throw new Error("Missing required fields: draftId, polishedText, derivatives");
  }
  
  const db = getFirestore();

  // Call LLM
  const scores = await callHuggingFace(polishedText, derivatives);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Save to Firestore
  const docRef = db.collection("round6_coherence").doc(draftId);
  await docRef.set({
    draftId,
    coherenceScore: averageScore,
    createdAt: new Date().toISOString(),
  });

  return { draftId, coherenceScore: averageScore };
}

export const r6_coherence = onCall(
  { timeoutSeconds: 300, memory: "1GiB" },
  async (request) => {
    const { draftId, polishedText, derivatives } = request.data;
    return runR6Coherence(draftId, polishedText, derivatives);
  }
);

// Export for testing
export const _test = {
    runR6Coherence
};
