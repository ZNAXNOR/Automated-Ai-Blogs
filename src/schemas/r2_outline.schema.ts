import { z } from 'zod';

export const r2_outline_input = z.object({
      idea: z.array(z.string()),
    });
    
export const r2_outline_output = z.object({
      outline: z.string(),
    });
