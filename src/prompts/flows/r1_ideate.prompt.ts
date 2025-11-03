import { ai } from '../../clients/genkitInstance.client';
import { z } from 'zod';
import { r1_ideate_prompt_output } from '../../schemas/flows/r1_ideate.schema';

export const ideationPrompt = ai.definePrompt({
  name: 'Round1_IdeationPrompt',
  description: 'A prompt that generates a blog post idea based on a trend.',
  model: 'googleai/gemini-2.5-flash',
  
  input: {
    schema: z.object({
      trendInput: z.string(),
    }),
  },

  output: {
    schema: r1_ideate_prompt_output,
  },

  config: {
    temperature: 0.7,
  },

  prompt: `
SYSTEM:
You are a creative content strategist.

TASK:
1.  Analyze the provided TREND_SIGNALS.
2.  Select a single, compelling blog post idea.
3.  Generate a title, a concise rationale, and a "seed" keyword phrase.
4.  Output the result as a single, valid JSON object that adheres to the schema.

SCHEMA FIELDS:
{
  "title": "string",
  "rationale": "string",
  "seed": "string",
  "sourceUrl": "string (optional)",
  "timestamp": "string (must be in ISO 8601 date-time format, e.g., YYYY-MM-DDTHH:mm:ss.sssZ)"
}

INPUT DATA:
TREND_SIGNALS:
{{trendInput}}

OUTPUT FORMAT:
Return valid JSON matching the schema exactly — no Markdown, no commentary.
`,
});