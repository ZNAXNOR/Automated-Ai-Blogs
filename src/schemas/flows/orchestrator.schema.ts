import { z } from 'zod';
import { r4_meta_output } from './r4_meta.schema';
import { r8_publish_output } from './r8_publish.schema';

export const orchestrator_input = z.object({
  topic: z.union([z.string(), z.array(z.string())]).describe("The topic(s) to start the blog generation pipeline."),
  tone: z.string().optional().describe("Optional tone for the article (e.g., 'professional', 'casual', 'humorous')."),
  publishStatus: z.enum(["draft", "publish", "pending", "private"]).optional().default("draft").describe("The desired status of the post in WordPress."),
});

export const orchestrator_output = z.object({
    pipelineId: z.string(),
    title: z.string(),
    content: z.string().describe("The final, polished blog content in Markdown format."),
    meta: r4_meta_output.optional(),
    publishResult: r8_publish_output,
});
