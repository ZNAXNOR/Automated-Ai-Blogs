import { z } from 'zod';

export const r5_meta_input = z.object({
      polished: z.string(),
    });
    
export const r5_meta_output = z.object({
      title: z.string(),
      seoDescription: z.string(),
      tags: z.array(z.string()),
    });
