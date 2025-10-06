import { BlogTopic } from '@clients/blogTopic';
import { z } from 'zod';

export const orchestrator_input = z.object({
  topic: z.enum(BlogTopic).optional(),
});

export const orchestrator_output = z.object({
  title: z.string(),
  content: z.string(),
  meta: z.object({
    seoDescription: z.string(),
    tags: z.array(z.string()),
  }),
  wp: z
    .object({
      id: z.number(),
      link: z.string(),
      status: z.string(),
    })
    .optional(),
});