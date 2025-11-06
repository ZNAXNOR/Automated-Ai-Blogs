import {z} from "zod";

export const EvaluateAllInputSchema = z.object({
  humanization: z.any().optional(),
  metadata: z.any().optional(),
  readability: z.any().optional(),
  seo: z.any().optional(),
});

export const EvaluateAllResultSchema = z.object({
  scores: z.object({
    humanization: z.number().default(0),
    metadata: z.number().default(0),
    readability: z.number().default(0),
    seo: z.number().default(0),
    overall: z.number().default(0),
  }),
  details: z.object({
    humanization: z.any().optional(),
    metadata: z.any().optional(),
    readability: z.any().optional(),
    seo: z.any().optional(),
  }),
  raw: z.any().optional(),
});

export type EvaluateAllInput = z.infer<typeof EvaluateAllInputSchema>;
export type EvaluateAllResult = z.infer<typeof EvaluateAllResultSchema>;
