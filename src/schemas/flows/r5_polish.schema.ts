import { z } from "zod";

/**
 * Image guidance schema (from r4_meta_output)
 */
export const ImagePromptSchema = z.object({
  type: z.enum(["ai_prompt", "stock_reference", "meme"]),
  description: z.string(),
  aiPrompt: z.string().optional(),
  styleGuidance: z.string().optional(),
  context: z.string().optional(),
});

/**
 * Metadata schema from r4
 */
export const R4MetaSchema = z.object({
  title: z.string(),
  slug: z.string(),
  seoDescription: z.string(),
  seoKeywords: z.array(z.string()),
  tags: z.array(z.string()),
  primaryCategory: z.string(),
  readingLevel: z.enum(["Beginner", "Intermediate", "Expert"]),
  featuredImage: ImagePromptSchema,
  additionalImages: z.array(ImagePromptSchema).optional(),
});

/**
 * Input schema for r5_polish
 * - Accepts either full draft text or individual sections from r3
 * - Includes r4 metadata for reference
 * - Adds blogTitle/topic to support flexible chaining
 */
export const r5_polish_input = z.object({
  blogTitle: z.string().optional(),
  topic: z.string().optional(),
  draft: z
    .object({
      sectionId: z.string().optional(),
      heading: z.string().optional(),
      content: z.string(),
    })
    .array()
    .optional(),
  fullDraft: z.string().optional(), // Alternative to sections
  meta: R4MetaSchema,
  tone: z.string().optional(), // Optional tone preference
});

/**
 * Output schema for r5_polish
 * - Single publication-ready blog string
 * - Markdown formatting, hashtags, static disclaimer included
 */
export const r5_polish_output = z.object({
  polishedBlog: z.string(), // Final blog content (Markdown + hashtags + disclaimer)
  readability: z.object({
    fkGrade: z.number().optional(),
  }),
});
