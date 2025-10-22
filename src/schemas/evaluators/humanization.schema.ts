import { z } from "zod";

export const HumanizationInputSchema = z.object({
  text: z.string().min(1, "Text is required"),
});

export const HumanizationResultSchema = z.object({
  score: z.number().min(0).max(100), // unified key
  detectedPatterns: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  raw: z.any().optional(),
});

export type HumanizationInput = z.infer<typeof HumanizationInputSchema>;
export type HumanizationResult = z.infer<typeof HumanizationResultSchema>;

/**
 * The optional LLM hook shape:
 * async (systemPrompt: string, prompt: string) => { score?: number, reasoning?: string, raw?: any }
 */
export type LLMGenerateHook = (systemPrompt: string, prompt: string) => Promise<any>;
