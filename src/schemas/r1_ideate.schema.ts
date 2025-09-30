import { z } from 'zod';

export const r1_ideate_input = z.object({
      topic: z.string().optional(),
      seedPrompt: z.string().optional(),
    });
    
export const r1_ideate_output = z.object({
      ideas: z.array(z.string()),
    });
