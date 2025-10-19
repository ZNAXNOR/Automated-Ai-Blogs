import { z } from 'zod';

/**
 * r3_draft.schema.ts
 *
 * Schemas used by r3_draft flow and subflows.
 * Mirrors r2_angle_output shape for input, and defines the r3 output.
 */

/**
 * Minimal schema for a single outline section coming from r2
 * (keeps flexible fields that r2 may include).
 */
export const OutlineSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  bullets: z.array(z.string()).optional().default([]),
  estWords: z.number().optional().default(200),
  // allow additional props but strongly typed ones above are important
}).passthrough();

export const OutlineSchema = z.object({
  title: z.string().optional().nullable(),
  sections: z.array(OutlineSectionSchema).default([]),
}).passthrough();

/**
 * r2_angle_output (input for r3)
 * We mirror the parts r3 needs: outline + research notes + any metadata
 */
export const r3_draft_input = z.object({
  outline: OutlineSchema,
  researchNotes: z.array(z.object({
    url: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
  })).optional().default([]),
  // preserve any extra fields r2 may include (e.g. angle, persona)
}).passthrough();

/**
 * Subflow input and output types
 */
export const r3_section_input = z.object({
  sectionId: z.string(),
  heading: z.string(),
  bullets: z.array(z.string()).optional().default([]),
  estWords: z.number().optional().default(200),
});

export const r3_section_output = z.object({
  sectionId: z.string(),
  heading: z.string(),
  content: z.string(),
});

/**
 * Final r3 draft output schema
 */
export const r3_draft_output = z.object({
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
