import { z } from "zod";

export const googleSearchInputSchema = z.object({
  query: z.string().describe("Search query"),
  num: z.number().int().min(1).max(10).optional(),
});

export const googleSearchOutputSchema = z.array(
  z.object({
    title: z.string(),
    snippet: z.string(),
    url: z.string(),
    displayLink: z.string().optional(),
    position: z.number().optional(),
  })
);
