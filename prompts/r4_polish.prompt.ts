// src/prompts/r4_polish.prompt.ts
import { ai } from '../src/clients/genkitInstance';
import { z } from 'zod';
import { r4_polish_output } from '../src/schemas/r4_polish.schema';

export const brandVoice = `
You are OdTech Lab's writing engine. Write in an entertaining, slightly cringy
brand voice: knowledgeable, playful, helpful, and respectful. Use a maximum of
one cringe line per ~300 words, and never more than three per article. Always
include a TL;DR, a 3-step actionable checklist, and at least one “pro tip”
callout. Explain jargon with simple analogies. Keep paragraphs short. Do not
invent sources. When unsure, say "as of [DATE]" and suggest external
verification.
`;

export const polishPrompt = ai.definePrompt({
  name: 'r4_polish_prompt',
  description: 'Polishes drafted sections to match OdTech Lab’s brand voice.',
  model: 'googleai/gemini-2.0-flash',
  input: {
    schema: z.object({
      sectionDraft: z.array(
        z.object({
          sectionId: z.string(),
          content: z.string(),
        })
      ),
      brandVoice: z.string(),
    }),
  },
  output: {
    schema: r4_polish_output,
  },
  config: {
    temperature: 0.35,
    maxOutputTokens: 4096,
    // topK: 50,
    // topP: 0.4,
    // stopSequences: ['<end>', '<fin>'],
  },
  prompt: `
SYSTEM: You are a copy editor enforcing brand voice and readability standards.

BRAND_VOICE:
{{brandVoice}}

TASK:
Polish each section in SECTION_DRAFT to align with the brand voice while improving
clarity, flow, and engagement. Maintain factual accuracy and existing citation
placeholders (e.g., [1], [2]).

STYLE:
- Aim for readability grade 8–10 (FK Grade)
- Keep paragraphs short (2–4 sentences)
- Preserve tone balance: helpful, humorous, yet credible
- Ensure all “pro tip”, “TL;DR”, and checklist sections remain intact if present

CONSTRAINTS:
- Do not add or remove facts.
- Do not merge or reorder sections.
- Maintain the same section IDs.

IMPORTANT OUTPUT RULES:
- Return ONLY a valid JSON array matching the schema below.
- Do NOT include any Markdown, code fences (\`\`\`), or explanations.
- Strings must use double quotes only.
- Numbers must not be wrapped in quotes.
- If input is unclear or incomplete, return an empty valid JSON array.

INPUT/SECTION_DRAFT:
{{sectionDraft}}
`,
});
