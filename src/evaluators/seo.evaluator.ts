/**
 * @file SEO Evaluator
 * Performs pre-publish SEO checks: title, meta, slug, keyword density, links, etc.
 */

import { z } from "zod";
import { ai } from "../clients/genkitInstance.client";
import { clamp, isKebabCase, wordCount } from "@utils/evaluator.util";
import { SEOInput, SEOResult, SEOInputSchema } from "../schemas/evaluators/seo.schema";

/** Keyword density helper */
function keywordDensity(content: string, keyword: string) {
  const words = (content || "").toLowerCase().match(/\b[a-z0-9']+\b/g) || [];
  const kw = (keyword || "").toLowerCase().match(/\b[a-z0-9']+\b/g) || [];
  if (!kw.length || !words.length) return 0;

  let occurrences = 0;
  for (let i = 0; i <= words.length - kw.length; i++) {
    let match = true;
    for (let j = 0; j < kw.length; j++) {
      if (words[i + j] !== kw[j]) {
        match = false;
        break;
      }
    }
    if (match) occurrences++;
  }
  return (occurrences / words.length) * 100;
}

export async function seoEvaluator(input: SEOInput): Promise<SEOResult> {
  const { title = "", metaDescription = "", slug = "", keywords = [], content = "", internalLinks = [], externalLinks = [] } = input;

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Title checks
  const titleLen = title.trim().length;
  if (!title) {
    issues.push("missing_title");
    recommendations.push("Add a descriptive title (~55-60 characters) containing the primary keyword.");
  } else if (titleLen < 35) {
    issues.push("short_title");
    recommendations.push("Title is short; consider making it more descriptive and include the primary keyword.");
  } else if (titleLen > 80) {
    issues.push("long_title");
    recommendations.push("Title is long; shorten toward 55-60 characters.");
  }

  // Meta description checks
  const metaLen = metaDescription.trim().length;
  if (!metaDescription) {
    issues.push("missing_meta_description");
    recommendations.push("Add a meta description (~150-160 chars) summarizing the article.");
  } else if (metaLen < 90) {
    issues.push("short_meta_description");
    recommendations.push("Meta description is short; expand and include the primary keyword and a CTA.");
  } else if (metaLen > 200) {
    issues.push("long_meta_description");
    recommendations.push("Meta description is long; shorten to ~150-160 characters.");
  }

  // Slug checks
  if (!slug) {
    issues.push("missing_slug");
    recommendations.push("Provide a slug in kebab-case containing the primary keyword.");
  } else {
    if (!isKebabCase(slug)) {
      issues.push("slug_not_kebab_case");
      recommendations.push("Use lowercase and hyphens for the slug (kebab-case).");
    }
    if (keywords.length > 0) {
      const primary = keywords[0].toLowerCase().replace(/\s+/g, "-");
      if (!slug.includes(primary)) {
        issues.push("keyword_not_in_slug");
        recommendations.push("Include the primary keyword in the slug for SEO benefit.");
      }
    }
  }

  // Keyword presence
  const missingPlaces: string[] = [];
  for (const kw of keywords || []) {
    const k = (kw || "").toLowerCase();
    if (k && !title.toLowerCase().includes(k)) missingPlaces.push(`keyword_missing_in_title:${kw}`);
    if (k && !metaDescription.toLowerCase().includes(k)) missingPlaces.push(`keyword_missing_in_meta:${kw}`);
    if (k && !content.toLowerCase().includes(k)) missingPlaces.push(`keyword_missing_in_body:${kw}`);
  }
  if (missingPlaces.length) {
    issues.push(...missingPlaces);
    recommendations.push("Ensure keywords appear in title, meta description, and body naturally.");
  }

  // Keyword density
  for (const kw of keywords || []) {
    const dens = keywordDensity(content, kw);
    if (dens > 3) {
      issues.push(`keyword_high_density:${kw}`);
      recommendations.push(`Reduce density of '${kw}' (current ~${dens.toFixed(2)}%). Aim for ~1-2%.`);
    } else if (dens > 0 && dens < 0.3) {
      issues.push(`keyword_low_density:${kw}`);
      recommendations.push(`Increase use of '${kw}' naturally in content (current ~${dens.toFixed(2)}%).`);
    }
  }

  // Links
  if (!internalLinks?.length) {
    issues.push("no_internal_links");
    recommendations.push("Add at least one internal link to related posts or landing pages.");
  }
  if (!externalLinks?.length) {
    recommendations.push("Consider adding authoritative external references to support claims.");
  }

  // Compute score
  let score = 100;
  const uniqueIssues = Array.from(new Set(issues));
  for (const it of uniqueIssues) {
    if (it.startsWith("missing_")) score -= 18;
    else if (it.includes("long_") || it.includes("short_")) score -= 8;
    else if (it.includes("slug") || it.includes("keyword_missing")) score -= 10;
    else if (it.includes("keyword_high_density") || it.includes("keyword_low_density")) score -= 6;
    else if (it === "no_internal_links") score -= 6;
    else score -= 4;
  }
  score = clamp(Math.round(score));

  if (!uniqueIssues.length) {
    recommendations.push("On-page SEO looks good. Consider running live SERP checks after publishing.");
  }

  return {
    score,
    issues: uniqueIssues,
    recommendations: Array.from(new Set(recommendations)),
    raw: { titleLen, metaLen, keywordCount: keywords.length, wc: wordCount(content) },
  };
}

/** ✅ Register evaluator with Genkit */
const SEODataPoint = z.object({
  input: z.unknown(),
  output: z.unknown().optional(),
  context: z.array(z.unknown()).optional(),
  reference: z.unknown().optional(),
  testCaseId: z.string().optional(),
  traceIds: z.array(z.string()).optional(),
});

/** Performs pre-publish SEO checks: title, meta, slug, keyword density, links, etc. */
export const SEOEvaluator = ai.defineEvaluator(
  {
    name: "seoEvaluator",
    displayName: "SEO Evaluator",
    definition: "Performs rule-based SEO checks for title, meta, slug, keywords, and links.",
    dataPointType: SEODataPoint,
  },
  async (dataPoint) => {
    const input = SEOInputSchema.parse(dataPoint.input);
    const result = await seoEvaluator(input);
    const { score, ...details } = result;

    return {
      testCaseId: dataPoint.testCaseId!,
      evaluation: {
        score: score,
        details,
      },
    };
  }
);
