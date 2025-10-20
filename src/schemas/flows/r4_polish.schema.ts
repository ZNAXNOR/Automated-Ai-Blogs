import { z } from "zod";

export const SectionDraftSchema = z.object({
  sectionId: z.string(),
  heading: z.string(),
  content: z.string(),
});

export const PolishedSectionSchema = z.object({
  sectionId: z.string(),
  heading: z.string(),
  polishedContent: z.string(),
  readabilityScore: z.number().optional(),
});

export const r4_polish_input = z.object({
  title: z.string(),
  description: z.string().optional(),
  sections: z.array(SectionDraftSchema).optional(),
  fullDraft: z.string(),
  brandVoice: z.string().optional(),
});

export const r4_polish_output = z.object({
  polishedSections: z.array(PolishedSectionSchema).optional(),
  polishedFullDraft: z.string(),
});

export type R4PolishInput = z.infer<typeof r4_polish_input>;
export type R4PolishOutput = z.infer<typeof r4_polish_output>;
