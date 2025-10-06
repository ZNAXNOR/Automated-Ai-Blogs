import { z } from 'zod';

export const r3_draft_input = z.object({
  outline: z.object({
    title: z.string(),
    sections: z.array(
      z.object({
        id: z.string(),
        heading: z.string(),
        bullets: z.array(z.string()),
        estWords: z.number(),
      })
    ),
  }),
});

export const r3_draft_output = z.object({
  draft: z.array(
    z.object({
      sectionId: z.string(),
      content: z.string(),
    })
  ),
});
