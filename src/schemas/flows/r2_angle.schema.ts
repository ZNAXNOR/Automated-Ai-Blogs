import { z } from 'zod';

export const r2_angle_input = z.object({
  idea: z.array(
    z.object({
      title: z.string(),
      rationale: z.string(),
      seed: z.string(),
    })
  ),
});

export const r2_angle_output = z.object({
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
