/**
 * @file Metadata Evaluator
 * Validates title, category, tags, and slug for a blog post.
 * Performs heuristic scoring and recommendations.
 */

import { z } from "zod";
import { ai } from "../clients/genkitInstance.client";
import {
  MetadataInput,
  MetadataResult,
  MetadataInputSchema,
} from "../schemas/evaluators/metadata.schema";
import { BLOG_TAGS } from "@src/clients/blogTag.client";
import { BLOG_TOPICS as RAW_BLOG_TOPICS } from "@src/clients/blogTopic.client";
import { isKebabCase, clamp } from "@utils/evaluator.util";

// Normalize topics and tags for case-insensitive comparison
const BLOG_TOPICS = RAW_BLOG_TOPICS.map((t) => t.toLowerCase());
const PREDEFINED_TAGS = (BLOG_TAGS || []).map((t) => t.toLowerCase());

export async function metadataEvaluator(input: MetadataInput): Promise<MetadataResult> {
  console.log('[metadataEvaluator] Starting evaluation with input:', JSON.stringify(input, null, 2));
  const title = (input?.title ?? "").trim();
  const category = (input?.category ?? "").trim();
  const tags = (input?.tags ?? []).map((t) => (t ?? "").trim());
  const slug = (input?.slug ?? "").trim();

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Title checks
  if (!title) {
    issues.push("title_missing");
    recommendations.push("Provide a non-empty title (< 80 characters).");
  } else if (title.length > 80) {
    issues.push("title_too_long");
    recommendations.push("Shorten the title to under 80 characters.");
  }

  // Category checks
  if (!category) {
    issues.push("category_missing");
    recommendations.push(`Set a category from allowed topics: ${RAW_BLOG_TOPICS.join(", ")}.`);
  } else if (!BLOG_TOPICS.includes(category.toLowerCase())) {
    issues.push("invalid_category");
    recommendations.push(`Category must be one of: ${RAW_BLOG_TOPICS.join(", ")}.`);
  }

  // Tag checks
  const unknownTags = tags.filter((t) => t && !PREDEFINED_TAGS.includes(t.toLowerCase()));
  if (unknownTags.length > 0) {
    issues.push("invalid_tags");
    recommendations.push(`Remove or standardize unknown tags: ${unknownTags.join(", ")}.`);
  }

  const lowerTags = tags.map((t) => t.toLowerCase());
  const duplicateTags = lowerTags.filter((v, i, arr) => v && arr.indexOf(v) !== i);
  if (duplicateTags.length > 0) {
    issues.push("duplicate_tags");
    recommendations.push("Remove duplicate tags.");
  }

  // Slug checks
  if (!slug) {
    issues.push("slug_missing");
    recommendations.push("Provide a slug in kebab-case derived from the title.");
  } else {
    if (!isKebabCase(slug)) {
      issues.push("slug_invalid_format");
      recommendations.push("Use lowercase letters and hyphens only in slug (kebab-case).");
    } else {
      const mainTitleWords = title
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z0-9]/g, ""))
        .filter(Boolean)
        .filter((w) => w.length > 3)
        .slice(0, 4);
      const containsMain = mainTitleWords.some((w) => w && slug.includes(w));
      if (!containsMain) {
        issues.push("slug_mismatch_title");
        recommendations.push("Ensure slug contains main keywords from the title.");
      }
    }
  }

  console.log(`[metadataEvaluator] Detected issues: ${issues.join(', ') || 'None'}`);

  // Score calculation
  let score = 100;
  if (issues.includes("title_missing")) score -= 40;
  if (issues.includes("title_too_long")) score -= 8;
  if (issues.includes("category_missing") || issues.includes("invalid_category")) score -= 20;
  if (issues.includes("invalid_tags")) score -= 10;
  if (issues.includes("duplicate_tags")) score -= 4;
  if (issues.includes("slug_missing")) score -= 10;
  if (issues.includes("slug_invalid_format")) score -= 6;
  if (issues.includes("slug_mismatch_title")) score -= 6;

  const finalScore = clamp(score);
  console.log(`[metadataEvaluator] Calculated score: ${finalScore}`);

  const result: MetadataResult = {
    score: finalScore,
    valid: issues.length === 0,
    issues: Array.from(new Set(issues)),
    recommendations: Array.from(new Set(recommendations)),
    raw: { acceptedTopics: RAW_BLOG_TOPICS, predefinedTags: BLOG_TAGS },
  };

  console.log('[metadataEvaluator] Final result:', JSON.stringify(result, null, 2));
  return result;
}

/** ✅ Register evaluator with Genkit */
const MetadataDataPoint = z.object({
  input: z.unknown(),
  output: z.unknown().optional(),
  context: z.array(z.unknown()).optional(),
  reference: z.unknown().optional(),
  testCaseId: z.string().optional(),
  traceIds: z.array(z.string()).optional(),
});

/**
 * Validates title, category, tags, and slug for a blog post.
 * Performs heuristic scoring and recommendations.
 */
export const MetadataEvaluator = ai.defineEvaluator(
  {
    name: "metadataEvaluator",
    displayName: "Metadata Evaluator",
    definition:
      "Validates blog metadata (title, category, tags, slug) and scores for correctness and style.",
    dataPointType: MetadataDataPoint,
  },
  async (dataPoint) => {
    console.log('[MetadataEvaluator] Running with dataPoint:', JSON.stringify(dataPoint, null, 2));
    const input = MetadataInputSchema.parse(dataPoint.input);
    const result = await metadataEvaluator(input);
    const { score, ...details } = result;

    const evaluationResult = {
      testCaseId: dataPoint.testCaseId!,
      evaluation: {
        score: score,
        details,
      },
    };
    console.log('[MetadataEvaluator] Final evaluation object:', JSON.stringify(evaluationResult, null, 2));
    return evaluationResult;
  }
);
