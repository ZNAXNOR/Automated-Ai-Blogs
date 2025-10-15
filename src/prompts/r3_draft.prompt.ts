import { ai } from '../clients/genkitInstance.client';
import { z } from 'zod';
import { r3_draft_output } from '../schemas/flows/r3_draft.schema';

export const draftPrompt = ai.definePrompt({
  name: 'Round3_DraftPrompt',
  description: 'Expands a blog post outline into a full draft.',
  model: 'googleai/gemini-2.0-flash',
  input: {
    schema: z.object({
      outline: z.any(), // accept full outline object
    }),
  },
  output: {
    schema: r3_draft_output,
  },
  config: {
    temperature: 0.0,
    // maxOutputTokens: 4096,
  },
  prompt: `
SYSTEM: You are a knowledgeable, neutral blog writer expanding structured outlines into coherent drafts.

TASK:
For each section in OUTLINE, write 120–220 words of polished content.
Use factual, neutral tone with clear explanations and examples.
Add inline citation placeholders like [1], [2] wherever external verification would be needed.

STYLE:
- Concise, educational, active voice.
- 1–2 short paragraphs per section.
- Avoid fluff, repetition, or opinions.
- Maintain section context; do not merge sections.

IMPORTANT OUTPUT RULES:
- Return ONLY a valid JSON array matching the schema below.
- Do NOT include any Markdown, code fences (\`\`\`), or extra text.
- Strings must use double quotes only.
- Each object must correspond to one section from OUTLINE.
- If input is missing or unclear, return an empty valid JSON array.

INPUT/OUTLINE:
{{outline}}
  `,
});
