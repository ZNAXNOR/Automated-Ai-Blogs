import {z} from "zod";

export const urlContextInputSchema = z.object({
  url: z.string().url().describe("The URL to fetch"),
});

export const urlContextOutputSchema = z.object({
  url: z.string().url(),
  title: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  contentType: z.string().nullable().optional(), // "article", "product", etc.
  wordCount: z.number().nullable().optional(),
  images: z.array(z.string()).default([]),
  lang: z.string().nullable().optional(),
  relevance: z.number().default(1),
});
