// src/prompts/r6_coherence.prompt.ts
import { ai } from '../clients/genkitInstance';
import { z } from 'zod';
import { r6_coherence_output } from '../schemas/r6_coherence.schema';

export const coherencePrompt = ai.definePrompt({
  name: 'r6_coherence_prompt',
  description: 'Analyzes blog coherence, redundancy, and logical flow without rewriting content.',
  model: 'googleai/gemini-2.0-flash',
  input: {
    schema: z.object({
      title: z.string(),
      seoDescription: z.string(),
      tags: z.array(z.string()),
      polished: z.array(
        z.object({
          sectionId: z.string(),
          content: z.string(),
        })
      ),
    }),
  },
  output: {
    schema: r6_coherence_output,
  },
  config: {
    temperature: 0.1,
    maxOutputTokens: 2048,
  },
  prompt: `
SYSTEM: You are a meticulous content auditor. 
Your job is to check that a blog post is coherent, non-redundant, and logically consistent.

TASKS:
1) Evaluate the overall coherence of the blog (how well sections connect and flow). 
   Score from 0.0 to 1.0.
2) Identify any duplicate or near-duplicate passages. 
   For each, reference the section ID and give a similarity score (0–1).
3) Provide a few short notes on strengths and weaknesses of the text.

CONSTRAINTS:
- Do NOT rewrite the blog, only analyze.
- Keep JSON strictly valid.
- Keep notes concise (max 2 sentences each).

IMPORTANT OUTPUT RULES:
- Return ONLY valid JSON that exactly matches the schema below.
- Do NOT include any extra text, explanation, or Markdown code fences (no \`\`\`).
- If you cannot fulfill the schema, return a valid empty JSON matching the schema shape.

INPUT:
Title:{{title}}, SeoDescription:{{seoDescription}}, Tags:{{tags}},
Content:{{polished}}
`
});
