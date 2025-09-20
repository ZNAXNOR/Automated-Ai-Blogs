/**
 * Implements metadata generation for polished drafts.
 * - Reads drafts from an array of strings.
 * - Generates SEO metadata and image suggestions via GenKit/LLM.
 * - Validates outputs and returns an array of metadata objects.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { LLMClient } from "../utils/llmClient";

// Constraints
const MAX_TITLE = 70;
const MAX_DESC = 160;
const EXCERPT_MIN_WORDS = 50;
const EXCERPT_MAX_WORDS = 100;
const MIN_DRAFT_LENGTH = 250; // Minimum characters for a draft to be processed

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface Metadata {
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  categories: string[];
  excerpt: string;
  relatedKeywords: string[];
  imageSuggestions: string[];
}

function validateMetadata(parsed: any): Metadata {
  if (!parsed.seoTitle || parsed.seoTitle.length > MAX_TITLE) {
    throw new Error("Invalid seoTitle");
  }
  if (!parsed.metaDescription || parsed.metaDescription.length > MAX_DESC) {
    throw new Error("Invalid metaDescription");
  }
  if (
    !parsed.excerpt ||
    countWords(parsed.excerpt) < EXCERPT_MIN_WORDS ||
    countWords(parsed.excerpt) > EXCERPT_MAX_WORDS
  ) {
    throw new Error("Invalid excerpt");
  }
  if (!Array.isArray(parsed.tags) || parsed.tags.length < 3) {
    throw new Error("Invalid tags");
  }
  if (!Array.isArray(parsed.categories) || parsed.categories.length < 1) {
    throw new Error("Invalid categories");
  }
  if (
    !Array.isArray(parsed.relatedKeywords) ||
    parsed.relatedKeywords.length < 3
  ) {
    throw new Error("Invalid relatedKeywords");
  }
  if (
    !Array.isArray(parsed.imageSuggestions) ||
    parsed.imageSuggestions.length === 0
  ) {
    throw new Error("Invalid imageSuggestions");
  }
  return parsed as Metadata;
}

async function generateMetaForDraft(draft: string, llm: LLMClient): Promise<Metadata | null> {
  if (!draft || draft.trim().length < MIN_DRAFT_LENGTH) {
    console.warn("R5: Skipping draft, too short.");
    return null;
  }

  const prompt = `
    System: You are an expert SEO strategist. Generate the following outputs as a single, valid JSON object:
    1. seoTitle (string, <= ${MAX_TITLE} chars)
    2. metaDescription (string, <= ${MAX_DESC} chars)
    3. tags (array of strings, min 3)
    4. categories (array of strings, min 1)
    5. excerpt (string, ${EXCERPT_MIN_WORDS}-${EXCERPT_MAX_WORDS} words)
    6. relatedKeywords (array of strings, min 3)
    7. imageSuggestions (array of strings, at least one prompt or reuse)

    Draft:
    ${draft}
  `;

  try {
    const res = await llm.generate({
      model: "gemini-1.5-flash",
      prompt,
      max_tokens: 800,
      temperature: 0.1,
    });

    const jsonText = res.text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonText) throw new Error("No valid JSON found in LLM response.");

    const parsed = JSON.parse(jsonText);
    return validateMetadata(parsed);

  } catch (error) {
    console.error("Error generating metadata:", error);
    return null; 
  }
}

export async function Round5_Meta(runId: string): Promise<void> {
    const db = getFirestore();
    const llm = new LLMClient();
    console.log(`R5: Starting Round 5 for runId=${runId}`);
  
    const r4ArtifactRef = db.doc(`runs/${runId}/artifacts/round4`);
    const r4ArtifactSnapshot = await r4ArtifactRef.get();
  
    if (!r4ArtifactSnapshot.exists) {
      console.log(`R5: No Round 4 artifact found. Exiting.`);
      return;
    }
    
    const r4Data = r4ArtifactSnapshot.data();
    const draftsToProcess = r4Data?.items || [];

    console.log(`R5: Found ${draftsToProcess.length} drafts to process.`);
  
    const metadataPromises = draftsToProcess.map(async (draft: any) => {
      const metadata = await generateMetaForDraft(draft.polished, llm);
      return { draftId: draft.id, metadata };
    });
  
    const results = await Promise.all(metadataPromises);
    const successfulResults = results.filter((r) => r.metadata);
    const failedCount = results.length - successfulResults.length;
  
    console.log(`R5: Successfully generated metadata for ${successfulResults.length} drafts.`);
    if (failedCount > 0) {
      console.warn(`R5: Failed to generate metadata for ${failedCount} drafts.`);
    }
  
    if (successfulResults.length > 0) {
      const batch = db.batch();
      const r5Collection = db.collection(`runs/${runId}/artifacts/round5_distribution`);
  
      successfulResults.forEach(({ draftId, metadata }) => {
        const docRef = r5Collection.doc(draftId);
        batch.set(docRef, {
          ...metadata,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
  
      await batch.commit();
      console.log(`R5: Saved ${successfulResults.length} metadata artifacts.`);
    }
  
    await db.doc(`runs/${runId}/artifacts/round5`).set({
      status: "completed",
      successCount: successfulResults.length,
      failureCount: failedCount,
      updatedAt: FieldValue.serverTimestamp(),
    });
  
    console.log(`R5: Round 5 finished for runId=${runId}.`);
  }

export const _test = {
    generateMetaForDraft
};
