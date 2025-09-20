/**
 * - Takes Round 4 polished text and derivatives
 * - Assesses coherence of the polished text against the derivatives
 * - Stores results in Firestore, passing through all data for the next round
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { env } from "../utils/config";
import fetch from "node-fetch";

interface CoherenceResult {
  draftId: string;
  coherenceScore: number;
}

async function callHuggingFace(text: string, textsToCompare: string[]): Promise<(number | null)[]> {
    const HF_API_URL = `https://api-inference.huggingface.co/models/${env.hfModelR6}`;

    const response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.hfToken}`,
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

    const data = (await response.json()) as (number | null)[];
    return data;
}

export async function runR6_Coherence(draftId: string, polishedText: string, derivatives: string[]): Promise<CoherenceResult> {
  if (!draftId || !polishedText || !Array.isArray(derivatives) || derivatives.length === 0) {
    throw new Error("Missing or invalid required fields: draftId, polishedText, or derivatives");
  }

  const scores = await callHuggingFace(polishedText, derivatives);

  if (scores.some(score => typeof score !== 'number' && score !== null)) {
      throw new Error("Invalid coherence scores received from API");
  }

  const totalScore = scores.reduce<number>((sum, score) => sum + (score || 0), 0);
  const averageScore = scores.length > 0 ? totalScore / scores.length : 0;

  return { draftId, coherenceScore: averageScore };
}

export async function Round6_Coherence(runId: string): Promise<void> {
  const db = getFirestore();
  console.log(`R6: Starting Round 6 for runId=${runId}`);

  const r4ArtifactsCollection = db.collection(`runs/${runId}/artifacts/round4_distribution`);
  const r4DocsSnapshot = await r4ArtifactsCollection.get();

  if (r4DocsSnapshot.empty) {
    console.log(`R6: No Round 4 artifacts found for runId=${runId}. Exiting.`);
    return;
  }

  const draftsToProcess: { id: string; data: any }[] = [];
  r4DocsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data && data.polished && Array.isArray(data.derivatives)) {
      draftsToProcess.push({ id: doc.id, data });
    }
  });

  console.log(`R6: Found ${draftsToProcess.length} drafts to process.`);

  const coherencePromises = draftsToProcess.map(async ({ id, data }) => {
    try {
      const { coherenceScore } = await runR6_Coherence(id, data.polished, data.derivatives);
      return {
        ...data,
        draftId: id,
        coherenceScore,
        validatedText: data.polished,
      };
    } catch (error) {
      console.error(`R6: Error processing draft ${id}:`, error);
      return null;
    }
  });

  const results = await Promise.all(coherencePromises);
  const successfulResults = results.filter((r) => r !== null) as any[];
  const failedCount = results.length - successfulResults.length;

  console.log(`R6: Successfully calculated coherence for ${successfulResults.length} drafts.`);
  if (failedCount > 0) {
    console.warn(`R6: Failed to calculate coherence for ${failedCount} drafts.`);
  }

  if (successfulResults.length > 0) {
    const r6Collection = db.collection(`runs/${runId}/artifacts/round6`);
    const batch = db.batch();

    successfulResults.forEach((result) => {
        const docRef = r6Collection.doc(result.draftId);
        delete result.polished; // Clean up redundant field
        batch.set(docRef, { ...result, createdAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
    console.log(`R6: Successfully saved ${successfulResults.length} coherence scores.`);
  }

  console.log(`R6: Round 6 finished for runId=${runId}.`);
}

export const _test = {
    runR6_Coherence,
};