import { ai } from '../clients/genkitInstance.client';
import { z } from 'zod';
import { r1_ideate_output } from '../schemas/flows/r1_ideate.schema';
import { googleSearchTool } from '@src/tools';

export const ideationPrompt = ai.definePrompt({
  name: 'Round1_IdeationPrompt',
  description:
    'Select a single winning seed idea from candidate topics, considering trend clusters, recent news, and optionally Google Search results.',
  model: 'googleai/gemini-2.0-flash',
  tools: [googleSearchTool],

  input: {
    schema: z.object({
      trendInput: z.string(),
      recentNews: z.string().optional(),
    }),
  },

  output: {
    schema: r1_ideate_output,
  },

  config: {
    temperature: 0.35,
  },

  prompt: `
SYSTEM:
You are a concise, data-aware content strategist specializing in trend-based blog ideation.

TASK:
Analyze the provided topic clusters (TREND_SIGNALS) and optional recent headlines (NEWS_SIGNALS).
Select a single best blog seed idea that is timely, original, and has high search potential.

REQUIREMENTS:
1. Output valid JSON matching the schema.
2. "title" must be catchy but realistic for a blog post.
3. Include a short "rationale" explaining why it’s relevant and viable. End with [source?].
4. Include "seed" keyword derived from the main trend.
5. Add "sourceUrl" for the *primary* site representing your final idea (if applicable).
6. Include a "references" array aggregating **all** useful URLs seen anywhere (news headlines, Google Search tool results, Gemini grounding, or other context).
   - Each entry should be:
     {
       "url": "https://...",
       "title": "Short title or domain",
       "snippet": "Short summary or note"
     }
7. Avoid generic topics unless supported by clear novelty or context.
8. Do NOT include Markdown, commentary, or code fences.

INPUT DATA:
TREND_SIGNALS:
{{trendInput}}

NEWS_SIGNALS:
{{recentNews}}

Return valid JSON only, matching the schema exactly. No extra text, markdown, or commentary.
`,
});
