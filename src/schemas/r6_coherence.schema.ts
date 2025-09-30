import { z } from 'zod';

export const r6_coherence_input = z.object({
    title: z.string(),
    seoDescription: z.string(),
    tags: z.array(z.string()),
    polished: z.string(),
  });
    
export const r6_coherence_output = z.object({
    finalContent: z.string(),
  });
