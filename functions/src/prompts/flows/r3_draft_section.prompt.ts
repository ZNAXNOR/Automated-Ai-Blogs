import { ai } from '../../clients/genkitInstance.client.js';
import { z } from 'zod';
import { r3_section_output } from '../../schemas/flows/r3_draft.schema.js';

export const draftSectionPrompt = ai.definePrompt({
  name: 'Round3_SectionDraftPrompt',
  description: 'Generates a single blog section from heading, bullets, and context.',
  model: 'googleai/gemini-2.0-flash',
  input: {
    schema: z.object({
      sectionId: z.string(),
      heading: z.string(),
      bullets: z.array(z.string()).optional(),
      estWords: z.number().optional(),
    }),
  },
  output: {
    schema: r3_section_output,
  },
  config: {
    temperature: 0.2,
    maxOutputTokens: 800,
  },
  prompt: `
SYSTEM: You are a professional blog writer creating one section of a blog using structured research.

INPUT:
- sectionId: {{sectionId}}
- heading: {{heading}}
- bullets: {{bullets}}
- estWords: {{estWords}}

CONTEXT:
Use the flow context 'r3_draft_context' containing the full outline and validated research notes.
Include relevant facts and examples from the research if available.

TASK:
- Write a cohesive, factual, and SEO-friendly section paragraph.
- Respect the estimated word count ({{estWords}}).
- Keep tone professional, informative, and concise.
- Output ONLY a JSON object matching:
  { "sectionId": "...", "heading": "...", "content": "..." }

IMPORTANT:
- No Markdown, code fences, or extra text.
- Strings must use double quotes.
  `,
});
