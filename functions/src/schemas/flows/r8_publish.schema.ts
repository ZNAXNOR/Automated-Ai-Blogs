import {z} from "zod";
import {r4MetaOutput} from "./r4_meta.schema.js";
import {r5PolishOutput} from "./r5_polish.schema.js";

/**
 * Input schema for r8Publish
 * Combines the final polished blog content with the necessary metadata.
 */
export const r8PublishInput = z.object({
  pipelineId: z.string(),
  polishedBlog: r5PolishOutput.shape.polishedBlog,
  meta: r4MetaOutput,
  // optional scheduling override
  publishAt: z
    .string()
    .datetime({offset: true})
    .optional()
    .describe("Optional ISO datetime (with offset) to schedule the post"),
  // optional override to force status (use with caution)
  statusOverride: z
    .enum(["draft", "publish", "future", "private", "pending"])
    .optional(),
});

export type R8PublishInput = z.infer<typeof r8PublishInput>;

/**
 * Output schema for r8Publish
 * Returns the results of the publishing action, along with the pipelineId.
 */
export const r8PublishOutput = z.object({
  pipelineId: z.string(),
  id: z.number().optional(),
  link: z.string().url().optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  slug: z.string().optional(),
  title: z.string().optional(),
  rawResponse: z.any().optional(),
  message: z.string().optional(),
});

export type R8PublishOutput = z.infer<typeof r8PublishOutput>;
