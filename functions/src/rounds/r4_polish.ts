/**
 * - Takes Round 3 drafts
 * - Produces polished text and distribution-ready derivatives
 * - Stores results in Firestore collection: round4_distribution
 */

import { onCall } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { getFirestore } from "firebase-admin/firestore";
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit
const ai = genkit({ plugins: [googleAI()] });

function buildPrompt(draftText: string): string {
  return `
System: You are a professional content strategist. 
You refine draft blog sections into polished, human-readable text, then decide the most effective distribution formats (social posts, email snippets, LinkedIn blurbs, tweet threads, etc.). 
Where suitable, embed inline suggestions for memes, screenshots, artwork, or other images. 
If no distribution formats apply, skip them. 
Always prioritize clarity and reader engagement.

User: Here is a draft blog section. 
1. First, polish the tone and readability. 
2. Then, generate relevant distribution outputs (skip if none apply). 
3. Where helpful, insert inline image suggestions.

Draft:
${draftText}
`;
}

async function runR4Polish(draftId: string, draftText: string) {
  if (!draftId || !draftText) {
    throw new Error("Missing required fields: draftId, draftText");
  }
  
  const db = getFirestore();

  const prompt = buildPrompt(draftText);

  // Call LLM
  const response = await ai.generate({
    prompt,
    output: {
      schema: z.object({
        polished: z.string(),
        derivatives: z.array(z.string()),
      }),
    }
  });

  if (!response.output) {
    throw new Error("AI failed to generate a response");
  }

  const { polished, derivatives } = response.output;

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
