import { firestore } from "firebase-admin";
import { z } from "zod";
import { LLMClient } from "../utils/llmClient";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const llm = new LLMClient();

// Firestore refs
const db = firestore();
const inputCollection = db.collection("round5_metadata");
const outputCollection = db.collection("round6_coherence");

// Schema for LLM JSON output validation
const CoherenceSchema = z.object({
  validatedText: z.string().min(20),
  issuesFound: z.array(z.string()),
  coherenceScore: z.number().min(0).max(1),
  metadataAlignment: z.boolean(),
});

export async function runRound6(trendId: string) {
  const doc = await inputCollection.doc(trendId).get();
  if (!doc.exists) throw new Error(`No Round5 doc found for ${trendId}`);

  const { draftText, metadata } = doc.data() as any;

  // Build prompt
  const prompt = `
You are a Coherence & Consistency Validator.  

Input:  
- Blog Draft: ${draftText}  
- Metadata: ${JSON.stringify(metadata)}  

Tasks:  
1. Check flow and coherence of the draft.  
2. Ensure metadata keywords and tags appear naturally in the text.  
3. Detect and flag duplicated, repetitive, or irrelevant sections.  
4. If content is already coherent → do not rewrite, just confirm.  
5. If content has minor incoherence → suggest minimal edits (do not expand).  

Output strictly in JSON:  
{
  "validatedText": "...",
  "issuesFound": ["..."],
  "coherenceScore": 0.0-1.0,
  "metadataAlignment": true/false
}
`;

  // Call LLM
  const raw = await llm.generate({
    prompt,
    model: "gemini-1.5-pro",
    temperature: 0,
    max_tokens: 1024,
  });

  let parsed;
  try {
    parsed = CoherenceSchema.parse(JSON.parse(raw.text));
  } catch (err) {
    throw new Error("Invalid LLM JSON output: " + err);
  }

  // Extra check: ensure validatedText is close to original length
  const ratio =
    parsed.validatedText.length / Math.max(draftText.length, 1);
  if (ratio < 0.9) {
    parsed.issuesFound.push("Validated text shorter than 90% of draft");
  }

  // Save to Firestore
  await outputCollection.doc(trendId).set({
    trendId,
    ...parsed,
  });

  return parsed;
}
