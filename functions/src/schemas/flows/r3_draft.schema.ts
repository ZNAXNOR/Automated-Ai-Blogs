import { z } from 'zod';
import { r2_angle_output } from './r2_angle.schema.js';

/**
 * r3_draft.schema.ts
 *
 * Schemas used by r3_draft flow and subflows.
 */

/**
 * The input for the r3 draft flow is the direct output from r2_angle.
 */
export const r3_draft_input = r2_angle_output;

/**
 * Subflow input and output types for generating a single section.
 */
export const r3_section_input = z.object({
  sectionId: z.string(),
  heading: z.string(),
  bullets: z.array(z.string()).optional().default([]),
  estWords: z.number().optional().default(200),
  // Include other elements for context
  title: z.string().optional(),
  researchNotes: r3_draft_input.shape.researchNotes.optional(),
});

export const r3_section_output = z.object({
  sectionId: z.string(),
  heading: z.string(),
  content: z.string(),
});

/**
 * Final r3 draft output schema.
 * It contains the generated draft and carries the pipelineId forward.
 */
export const r3_draft_output = z.object({
  pipelineId: z.string(),
  title: z.string().optional().nullable(),
  subtitle: z.string().optional().nullable(),
  sections: z.array(r3_section_output),
  description: z.string().optional().nullable(),
  readingTime: z.string().optional().nullable(),
  fullDraft: z.string(),
  // metadata for persistence/debugging
  createdAt: z.string().optional(),
  source: z.string().optional(),
}).passthrough();

/**
 * Type exports for convenience
 */
export type R3DraftInput = z.infer<typeof r3_draft_input>;
export type R3SectionInput = z.infer<typeof r3_section_input>;
export type R3SectionOutput = z.infer<typeof r3_section_output>;
export type R3DraftOutput = z.infer<typeof r3_draft_output>;
