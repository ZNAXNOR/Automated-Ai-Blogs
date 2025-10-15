import { z } from "zod";

export const urlContextInputSchema = z.object({
  url: z.string().url().describe("The URL to fetch"),
});

export const urlContextOutputSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  text: z.string().optional(),
  images: z.array(z.string()),
  lang: z.string().nullable().optional(),
});
