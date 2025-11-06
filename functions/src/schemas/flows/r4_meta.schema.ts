import {z} from "zod";
import {r3DraftOutput} from "./r3_draft.schema.js";

/**
 * r4_meta.schema.ts
 *
 * Schema definitions for the Round 4 — Metadata & SEO Enrichment flow.
 */

/**
 * Input schema — takes the full output from r3_draft and makes title
 * required. It also explicitly includes 'topic' and 'tone' which are
 * expected to be passed through.
 */
export const r4MetaInput = r3DraftOutput.extend({
  title: z.string().describe(
    "Title from the draft stage. Must be provided."
  ),
  topic: z.string().optional().describe(
    "Main theme or focus of the article. " +
    "Overrides topic from previous steps if provided."
  ),
  tone: z.string().optional().describe(
    "Optional tone or style preferences. " +
    "Overrides tone from previous steps if provided."
  ),
});

/**
 * Image guidance schema
 */
export const imagePromptSchema = z.object({
  type: z.enum(["ai_prompt", "stock_reference", "meme"]),
  description: z.string(),
  aiPrompt: z.string().optional(),
  styleGuidance: z.string().optional(),
  context: z.string().optional(),
});

/**
 * Output schema — full metadata and enrichment information, plus pipelineId.
 */
const metaOutputCore = z.object({
  title: z.string(),
  slug: z.string(),
  seoDescription: z.string(),
  seoKeywords: z.array(z.string()),
  tags: z.array(z.string()),
  primaryCategory: z.string(),
  readingLevel: z.enum(["Beginner", "Intermediate", "Expert"]),
  featuredImage: imagePromptSchema,
  additionalImages: z.array(imagePromptSchema).optional(),
});

export const r4MetaOutput = metaOutputCore.extend({
  pipelineId: z.string(),
});

/**
 * Type exports
 */
export type R4MetaInput = z.infer<typeof r4MetaInput>;
export type R4MetaOutput = z.infer<typeof r4MetaOutput>;
export type ImagePrompt = z.infer<typeof imagePromptSchema>;
