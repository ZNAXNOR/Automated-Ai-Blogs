import { z } from "zod";

export const r2_angle_input = z.object({
  idea: z.array(
    z.object({
      title: z.string(),
      rationale: z.string(),
      seed: z.string(),
      sourceUrl: z.string().url().optional().nullable(),
      references: z
        .array(
          z.object({
            url: z.string().url(),
            title: z.string().optional(),
            snippet: z.string().optional(),
          })
        )
        .optional()
        .nullable(),
    })
  ),
});

export const r2_angle_output = z.object({
  researchNotes: z.array(
    z.object({
      url: z.string().url(),
      title: z.string().optional(),
      summary: z.string().optional(),
      relevance: z.number().optional(),
    })
  ),
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
