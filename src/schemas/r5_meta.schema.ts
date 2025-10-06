import { z } from 'zod';

export const r5_meta_input = z.object({
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

export const r5_meta_output = z.object({
  title: z.string(),
  seoDescription: z.string(),
  slug: z.string(),
  tags: z.array(z.string()),
  images: z.array(
    z.object({
      prompt: z.string(),
      negative: z.array(z.string()),
      altText: z.string(),
    })
  ),
});
