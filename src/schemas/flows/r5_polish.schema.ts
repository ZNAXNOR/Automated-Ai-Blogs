import { z } from "zod";
import { r4_meta_output } from "./r4_meta.schema";

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
  meta: r4_meta_output,
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
  usedImages: z
    .array(
      z.object({
        type: z.enum(["ai_prompt", "meme", "stock_reference"]),
        description: z.string(),
        aiPrompt: z.string().optional(),
        context: z.string().optional(),
        alt: z.string(),
      })
    )
    .optional(),
});