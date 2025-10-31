import { z } from "zod";
import { r1_ideate_output } from "./r1_ideate.schema";

// r2 input is the output of r1.
// This assumes the orchestrator runs this flow for one idea at a time.
export const r2_angle_input = r1_ideate_output;

const angleOutputCore = z.object({
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

// The final output of the r2 flow must include the pipelineId for the next step.
export const r2_angle_output = angleOutputCore.extend({
  pipelineId: z.string(),
});
