import { ai } from '../src/clients/genkitInstance';
import { z } from 'zod';
import { r1_ideate_output } from '../src/schemas/r1_ideate.schema';

export const ideationPrompt = ai.definePrompt({
  name: 'r1_ideate_prompt',
  description: 'Brainstorms blog post ideas based on a given topic or trend.',
  model: 'googleai/gemini-2.0-flash',
  input: {
    schema: z.object({
      trendInput: z.string(),
    })
  },
  output: {
    schema: r1_ideate_output,
  },
  config: {
    temperature: 0.35,
    maxOutputTokens: 2048,
    // topK: 50,
    // topP: 0.4,
    // stopSequences: ['<end>', '<fin>'],
  },
  prompt: `
SYSTEM: You are a concise content strategist. You propose practical blog post
titles based on trend signals. Avoid speculation; use [source?] placeholders.

TASK:
Given TREND_SIGNALS, produce 3–5 titles with one-sentence rationales.
Titles must be specific, useful, and non-clickbait.

CONSTRAINTS:
- Include at least one primary keyword from input.
- Maintain a neutral, professional tone.
- Each rationale ends with [source?].
- Do not include headings, comments, or Markdown.

IMPORTANT OUTPUT RULES:
- Return ONLY a valid JSON object exactly matching the schema below.
- No Markdown, no code fences (\`\`\`), no extra text.
- Strings must use double quotes.
- If unsure or incomplete, return an empty JSON object.

INPUT/TREND_SIGNALS: {{trendInput}}
`
});
