import { z } from 'zod';
import { r0_trends_output } from './r0_trends.schema.js';

export const r1_ideate_input = r0_trends_output.extend({
  pipelineId: z.string(),
  seedPrompt: z.string().optional(),
});

export const referenceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  snippet: z.string().optional(),
});

// Base schema for the prompt output
export const r1_ideate_prompt_output = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters long'),
    rationale: z.string().min(10, 'Rationale must be descriptive'),
    seed: z.string().min(1, 'Seed keyword required'),
    sourceUrl: z.string().url().optional().nullable(),
    references: z.array(referenceSchema).optional().nullable(),
    timestamp: z
        .string()
        .datetime({ offset: true })
        .optional()
        .default(new Date().toISOString()),
});

// Schema for the overall flow output, which includes the pipelineId
export const r1_ideate_output = r1_ideate_prompt_output.extend({
  pipelineId: z.string(),
  topic: z.string(),
});
