import { z } from "zod";
import { r3_draft_output } from "./r3_draft.schema";
import { r4_meta_output } from "./r4_meta.schema";

/**
 * Input schema for r5_polish
 * This combines the draft from r3 and the metadata from r4.
 */
export const r5_polish_input = z.object({
  pipelineId: z.string(),
  draft: r3_draft_output,
  meta: r4_meta_output,
  tone: z.string().optional(), // Optional tone preference
});

const polishOutputCore = z.object({
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

/**
 * Output schema for r5_polish
 * Contains the final polished blog and the pipelineId.
 */
export const r5_polish_output = polishOutputCore.extend({
    pipelineId: z.string(),
});
