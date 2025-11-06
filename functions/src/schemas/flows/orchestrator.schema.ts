import {z} from "zod";
import {r4MetaOutput} from "./r4_meta.schema";
import {r8PublishOutput} from "./r8_publish.schema";

export const orchestratorInput = z.object({
  topic: z.union([z.string(), z.array(z.string())])
    .describe("The topic(s) to start the blog generation pipeline."),
  tone: z.string()
    .optional()
    .describe(
      "Optional tone for the article " +
      "(e.g., 'professional', 'casual', 'humorous')."
    ),
  publishStatus: z.enum(
    ["draft", "publish", "pending", "private"]
  ).optional().default("draft")
    .describe("The desired status of the post in WordPress."),
});

export const orchestratorOutput = z.object({
  pipelineId: z.string(),
  title: z.string(),
  content: z.string().describe(
    "The final, polished blog content in Markdown format."
  ),
  meta: r4MetaOutput.optional(),
  publishResult: r8PublishOutput,
});
