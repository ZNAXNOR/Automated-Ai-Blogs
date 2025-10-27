// r8_publish.schema.ts
import { z } from "zod";
import { ImagePromptSchema } from "./r4_meta.schema";

/**
 * Meta object coming from r4 (trimmed to the fields we need for publishing)
 */
export const R4MetaSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  primaryCategory: z.string().optional(),
  readingLevel: z.string().optional(),
  // featuredImage and additionalImages are image prompt descriptors (not WP media IDs)
  featuredImage: ImagePromptSchema.optional(),
  additionalImages: z.array(ImagePromptSchema).optional(),
});

/**
 * Input schema for r8_publish (updated to accept polishedBlog + meta)
 */
export const r8_publish_input = z.object({
  polishedBlog: z.string().min(1).describe("Final blog content (Markdown or HTML) from r5"),
  meta: R4MetaSchema,
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
 * Mirrors useful WP return fields and provides rawResponse for debugging (optional)
 */
export const r8_publish_output = z.object({
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
