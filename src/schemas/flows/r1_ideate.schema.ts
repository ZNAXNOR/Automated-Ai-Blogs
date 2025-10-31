import { z } from 'zod';

const suggestionSchema = z.object({
  topic: z.string().min(1, 'Topic cannot be empty'),
  score: z.number().min(100).optional().default(0.5),
});

const resultSchema = z.object({
  topic: z.string().min(1),
  suggestions: z.array(suggestionSchema).optional().default([]),
  trendTimeline: z.array(z.any()).optional().default([]),
});

export const r1_ideate_input = z.object({
  pipelineId: z.string(),
  topic: z.string().optional(), // single topic (fallback)
  seedPrompt: z.string().optional(), // manual seed
  aggregatedTopics: z.array(z.string()).optional(), // from trend aggregation
  suggestions: z.array(suggestionSchema).optional(), // flattened suggestions
  results: z.array(resultSchema).optional(), // structured r0 output
  trendTimeline: z.array(z.any()).optional(), // timeline data if directly passed
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
});
