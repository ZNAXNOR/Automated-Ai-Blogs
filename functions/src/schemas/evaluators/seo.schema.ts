import { z } from "zod";

export const SEOInputSchema = z.object({
  title: z.string(),
  metaDescription: z.string(),
  slug: z.string(),
  keywords: z.array(z.string()).default([]),
  content: z.string(),
  internalLinks: z.array(z.string()).optional(),
  externalLinks: z.array(z.string()).optional(),
});

export const SEOResultSchema = z.object({
  score: z.number().min(0).max(100),
  issues: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  raw: z.any().optional(),
});

export type SEOInput = z.infer<typeof SEOInputSchema>;
export type SEOResult = z.infer<typeof SEOResultSchema>;
