import {z} from "zod";
import {r0TrendsOutput} from "./r0_trends.schema.js";

export const r1IdeateInput = r0TrendsOutput.extend({
  pipelineId: z.string(),
  seedPrompt: z.string().optional(),
});

export const referenceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  snippet: z.string().optional(),
});

// Base schema for the prompt output
export const r1IdeatePromptOutput = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long"),
  rationale: z.string().min(10, "Rationale must be descriptive"),
  seed: z.string().min(1, "Seed keyword required"),
  sourceUrl: z.string().url().optional().nullable(),
  references: z.array(referenceSchema).optional().nullable(),
  timestamp: z
    .string()
    .datetime({offset: true})
    .optional()
    .default(new Date().toISOString()),
});

// Schema for the overall flow output, which includes the pipelineId
export const r1IdeateOutput = r1IdeatePromptOutput.extend({
  pipelineId: z.string(),
  topic: z.string(),
});
