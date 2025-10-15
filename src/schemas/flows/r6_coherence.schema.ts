import { z } from 'zod';

export const r6_coherence_input = z.object({
  title: z.string(),
  seoDescription: z.string(),
  tags: z.array(z.string()),
  polished: z.array(
    z.object({
      sectionId: z.string(),
      content: z.string(),
      readability: z.object({
        fkGrade: z.number(),
      }),
    })
  ),
});

export const r6_coherence_output = z.object({
  overall: z.number(),
  duplicates: z.array(
    z.object({
      againstId: z.string(),
      score: z.number(),
    })
  ),
  notes: z.array(z.string()),
});
