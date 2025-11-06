import {z} from "zod";

export const ReadabilityInputSchema = z.object({
  text: z.string(),
});

export const ReadabilityResultSchema = z.object({
  score: z.number().min(0).max(100),
  gradeLevel: z.string(),
  details: z.object({
    flesch_kincaid: z.number().nullable().optional(),
    gunning_fog: z.number().nullable().optional(),
    smog_index: z.number().nullable().optional(),
  }).optional(),
  raw: z.any().optional(),
});

export type ReadabilityInput = z.infer<typeof ReadabilityInputSchema>;
export type ReadabilityResult = z.infer<typeof ReadabilityResultSchema>;
