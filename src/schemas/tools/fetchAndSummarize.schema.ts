import { z } from "zod";

export const fetchAndSummarizeInputSchema = z.object({
  query: z.string().describe("Search query"),
});

export const fetchAndSummarizeOutputSchema = z.object({
  query: z.string(),
  topResult: z.object({
    title: z.string(),
    snippet: z.string(),
    url: z.string(),
  }),
  context: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    text: z.string().optional(),
    images: z.array(z.string()),
  }),
});
