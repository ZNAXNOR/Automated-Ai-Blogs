import {z} from "zod";
import {r2AngleOutput} from "./r2_angle.schema";

/**
 * r3_draft.schema.ts
 *
 * Schemas used by r3_draft flow and subflows.
 */

/**
 * The input for the r3 draft flow is the direct output from r2_angle.
 */
export const r3DraftInput = r2AngleOutput;

/**
 * Subflow input and output types for generating a single section.
 */
export const r3SectionInput = z.object({
  sectionId: z.string(),
  heading: z.string(),
  bullets: z.array(z.string()).optional().default([]),
  estWords: z.number().optional().default(200),
  // Include other elements for context
  title: z.string().optional(),
  researchNotes: r3DraftInput.shape.researchNotes.optional(),
});

export const r3SectionOutput = z.object({
  sectionId: z.string(),
  heading: z.string(),
  content: z.string(),
});

/**
 * Final r3 draft output schema.
 * It contains the generated draft and carries the pipelineId forward.
 */
export const r3DraftOutput = z.object({
  pipelineId: z.string(),
  title: z.string().optional().nullable(),
  subtitle: z.string().optional().nullable(),
  sections: z.array(r3SectionOutput),
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
export type R3DraftInput = z.infer<typeof r3DraftInput>;
export type R3SectionInput = z.infer<typeof r3SectionInput>;
export type R3SectionOutput = z.infer<typeof r3SectionOutput>;
export type R3DraftOutput = z.infer<typeof r3DraftOutput>;
