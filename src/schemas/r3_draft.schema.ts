import { z } from 'zod';

export const r3_draft_input = z.object({
      outline: z.string(),
    });
    
export const r3_draft_output = z.object({
      draft: z.string(),
    });
