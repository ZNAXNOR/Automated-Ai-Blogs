import { z } from "zod";

export const MetadataInputSchema = z.object({
  title: z.string().default(""),
  category: z.string().default(""),
  tags: z.array(z.string()).default([]),
  slug: z.string().default(""),
});

export const MetadataResultSchema = z.object({
  score: z.number().min(0).max(100),
  valid: z.boolean(),
  issues: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  raw: z.any().optional(),
});

export type MetadataInput = z.infer<typeof MetadataInputSchema>;
export type MetadataResult = z.infer<typeof MetadataResultSchema>;
