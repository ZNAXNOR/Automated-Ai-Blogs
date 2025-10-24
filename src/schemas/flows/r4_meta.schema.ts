import { z } from 'zod';

/**
 * r4_meta.schema.ts
 *
 * Schema definitions for the Round 4 — Metadata & SEO Enrichment flow.
 * Builds on top of the r3 draft output by taking minimal input fields
 * and generating comprehensive metadata and media guidance.
 */

/**
 * Input schema — minimal fields from previous draft.
 */
export const r4_meta_input = z.object({
  blogTitle: z.string().describe('Title from the previous ideation or draft stage.'),
  draftText: z.string().describe('Full draft text from r3_draft output.'),
  topic: z.string().optional().describe('Main theme or focus of the article.'),
  tone: z.string().optional().describe('Optional tone or style preferences.'),
});

/**
 * Image guidance schema
 */
export const ImagePromptSchema = z.object({
  type: z.enum(['ai_prompt', 'stock_reference', 'meme']),
  description: z.string(),
  aiPrompt: z.string().optional(),
  styleGuidance: z.string().optional(),
  context: z.string().optional(),
});

/**
 * Output schema — full metadata and enrichment information.
 */
export const r4_meta_output = z.object({
  title: z.string(),
  slug: z.string(),
  seoDescription: z.string(),
  seoKeywords: z.array(z.string()),
  tags: z.array(z.string()),
  primaryCategory: z.string(),
  readingLevel: z.enum(['Beginner', 'Intermediate', 'Expert']),
  featuredImage: ImagePromptSchema,
  additionalImages: z.array(ImagePromptSchema).optional(),
});

/**
 * Type exports
 */
export type R4MetaInput = z.infer<typeof r4_meta_input>;
export type R4MetaOutput = z.infer<typeof r4_meta_output>;
export type ImagePrompt = z.infer<typeof ImagePromptSchema>;
