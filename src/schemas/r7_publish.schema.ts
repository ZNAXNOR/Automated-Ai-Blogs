import { z } from 'zod';

export const r7_publish_input = z.object({
  title: z.string(),
  content: z.string(),
  status: z.enum(['draft', 'publish']).default('draft'),
});

export const r7_publish_output = z.object({
  id: z.number(),
  link: z.string(),
  status: z.string(),
});
