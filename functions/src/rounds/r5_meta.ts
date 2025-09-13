/**
 * r5_meta.ts
 *
 * Implements metadata generation for polished drafts.
 * - Reads drafts from an array of strings.
 * - Generates SEO metadata and image suggestions via GenKit/LLM.
 * - Validates outputs and returns an array of metadata objects.
 */

import { LLMClient } from "../utils/llmClient";

// Constraints
const MAX_TITLE = 70;
const MAX_DESC = 160;
const EXCERPT_MIN_WORDS = 50;
const EXCERPT_MAX_WORDS = 100;

const llm = new LLMClient();

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function generateMetaForDraft(draft: string): Promise<any> {
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
      temperature: 0.1, // Slightly creative for better assets
    });

    const jsonText = res.text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonText) throw new Error("No valid JSON found in LLM response.");

    const parsed = JSON.parse(jsonText);

    // --- Validation --- 
    if (!parsed.seoTitle || parsed.seoTitle.length > MAX_TITLE) throw new Error("Invalid seoTitle");
    if (!parsed.metaDescription || parsed.metaDescription.length > MAX_DESC) throw new Error("Invalid metaDescription");
    if (!parsed.excerpt || countWords(parsed.excerpt) < EXCERPT_MIN_WORDS || countWords(parsed.excerpt) > EXCERPT_MAX_WORDS) throw new Error("Invalid excerpt");
    if (!Array.isArray(parsed.tags) || parsed.tags.length < 3) throw new Error("Invalid tags");
    if (!Array.isArray(parsed.categories) || parsed.categories.length < 1) throw new Error("Invalid categories");
    if (!Array.isArray(parsed.relatedKeywords) || parsed.relatedKeywords.length < 3) throw new Error("Invalid relatedKeywords");
    if (!Array.isArray(parsed.imageSuggestions) || parsed.imageSuggestions.length === 0) throw new Error("Invalid imageSuggestions");

    return parsed;

  } catch (error) {
    console.error("Error generating metadata:", error);
    return null; // Return null to indicate failure for this draft
  }
}

export async function runRound5(drafts: string[]): Promise<any[]> {
  const results = await Promise.all(drafts.map(generateMetaForDraft));
  return results.filter((result) => result !== null);
}
