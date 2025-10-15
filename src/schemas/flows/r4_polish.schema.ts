import { z } from 'zod';

export const r4_polish_input = z.object({
  draft: z.array(
    z.object({
      sectionId: z.string(),
      content: z.string(),
    })
  ),
});

export const r4_polish_output = z.object({
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
