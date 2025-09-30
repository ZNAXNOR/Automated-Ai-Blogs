import { z } from 'zod';

export const r4_polish_input = z.object({
      draft: z.string(),
    });
    
export const r4_polish_output = z.object({
      polished: z.string(),
    });
