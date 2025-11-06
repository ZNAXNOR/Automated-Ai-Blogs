import {z} from "zod";
import {r3DraftOutput} from "./r3_draft.schema.js";
import {r4MetaOutput} from "./r4_meta.schema.js";

/**
 * Input schema for r5Polish
 * This combines the draft from r3 and the metadata from r4.
 */
export const r5PolishInput = z.object({
  pipelineId: z.string(),
  draft: r3DraftOutput,
  meta: r4MetaOutput,
  tone: z.string().optional(), // Optional tone preference
});

const polishOutputCore = z.object({
  polishedBlog: z.string(),
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
 * Output schema for r5Polish
 * Contains the final polished blog and the pipelineId.
 */
export const r5PolishOutput = polishOutputCore.extend({
  pipelineId: z.string(),
});
