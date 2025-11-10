import { ai } from '../../clients/genkitInstance.client.js';
import { z } from 'zod';
import { r2_angle_output } from '../../schemas/flows/r2_angle.schema.js';

/**
 * Round2_AnglePrompt
 * -------------------
 * Consumes topic ideas + grounded research notes (tool outputs)
 * to create a well-structured blog outline with factual grounding.
 *
 * - No hallucination: Only use `researchNotes.summary` for factual content.
 * - `topicIdea` provides the intent and direction.
 * - `researchNotes` are tool-generated, factual, and immutable.
 *
 * This prompt does *not* call the urlContextTool itself — it *consumes*
 * the tool results provided by the r2 flow.
 */

export const anglePrompt = ai.definePrompt({
  name: 'Round2_AnglePrompt',
  description:
    'Synthesizes a grounded blog outline using topic ideas and factual research notes.',
  model: 'googleai/gemini-2.5-flash',

  input: {
    schema: z.object({
      topicIdea: z.array(
        z.object({
          title: z.string(),
          rationale: z.string().optional(),
          seed: z.string().optional(),
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
      researchNotes: z.array(
        z.object({
          url: z.string().url(),
          title: z.string().optional(),
          summary: z.string(),
          contentType: z.string().optional(),
          wordCount: z.number().optional(),
        })
      ),
    }),
  },

  output: {
    schema: r2_angle_output,
  },

  config: { temperature: 0.1 },

  prompt: `
SYSTEM:
You are a precise blog strategy and content planning assistant.
You will synthesize a structured outline grounded **only** in verified research notes.

TASK:
1. Review the user's topic ideas.
2. Review the factual summaries and metadata.
3. Create a comprehensive blog outline that reflects SEO intent, topical authority, and logical flow.
4. Use information *strictly* from researchNotes summaries — do NOT invent or assume data.
5. Include:
   - Introduction
   - 5–8 main sections (id: s1, s2, ...)
   - Each section has: heading, 3–5 concise bullets, estWords (estimated word count)
   - Conclusion section

STYLE:
- Objective, reader-friendly tone.
- No marketing fluff.
- Sections should logically follow the topic’s purpose.
- Every statement must trace back to a research note summary.

TOPIC IDEAS:
{{topicIdea}}

RESEARCH NOTES:
{{researchNotes}}


OUTPUT FORMAT:
Return ONLY valid JSON matching r2_angle_output schema.
Do not include Markdown, prose, or code fences.

EXAMPLE OUTPUT STRUCTURE:
{
  "outline": {
    "title": "<final blog title>",
    "sections": [
      { "id": "s1", "heading": "Introduction", "bullets": ["..."], "estWords": 120 },
      { "id": "s2", "heading": "...", "bullets": ["..."], "estWords": 180 },
      ...
      { "id": "sN", "heading": "Conclusion", "bullets": ["..."], "estWords": 100 }
    ]
  },
  "researchNotesUsed": ["<url1>", "<url2>", ...]
}
  `,
});