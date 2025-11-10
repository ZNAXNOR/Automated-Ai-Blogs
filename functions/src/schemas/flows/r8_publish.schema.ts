import { z } from "zod";
import { r4_meta_output, ImagePromptSchema } from "./r4_meta.schema.js";
import { r5_polish_output } from "./r5_polish.schema.js";

/**
 * Input schema for r8_publish
 * Combines the final polished blog content with the necessary metadata.
 */
export const r8_publish_input = z.object({
  pipelineId: z.string(),
  polishedBlog: r5_polish_output.shape.polishedBlog,
  meta: r4_meta_output,
  // optional scheduling override
  publishAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe("Optional ISO datetime (with offset) to schedule the post"),
  // optional override to force status (use with caution)
  statusOverride: z
    .enum(["draft", "publish", "future", "private", "pending"])
    .optional(),
});

export type R8PublishInput = z.infer<typeof r8_publish_input>;

/**
 * Output schema for r8_publish
 * Returns the results of the publishing action, along with the pipelineId.
 */
export const r8_publish_output = z.object({
  pipelineId: z.string(),
  id: z.number().optional(),
  link: z.string().url().optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  slug: z.string().optional(),
  title: z.string().optional(),
  // captured WP raw response (useful for debugging). Avoid printing it in prod logs.
  rawResponse: z.any().optional(),
  message: z.string().optional(),
});

export type R8PublishOutput = z.infer<typeof r8_publish_output>;
