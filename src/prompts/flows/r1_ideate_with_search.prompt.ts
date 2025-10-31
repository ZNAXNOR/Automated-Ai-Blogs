import { ai } from '../../clients/genkitInstance.client';
import { z } from 'zod';
import { r1_ideate_prompt_output } from '../../schemas/flows/r1_ideate.schema';
import { googleSearchTool } from '@src/tools';

export const ideationPromptWithSearch = ai.definePrompt({
  name: 'Round1_IdeationPrompt_With_Search',
  description: 'Guaranteed Google Search tool invocation for context enrichment.',
  model: 'googleai/gemini-2.0-flash',
  tools: [googleSearchTool],

  input: {
    schema: z.object({
      trendInput: z.string(),
      recentNews: z.string().optional(),
    }),
  },

  output: {
    schema: r1_ideate_prompt_output,
  },

  config: {
    temperature: 0.3,
  },

  prompt: `
SYSTEM:
You are a precise, research-oriented content strategist.
The given trend lacks sufficient real-world context — you MUST use the Google Search tool to gather context.

TASK:
Use the registered Google Search tool to fetch **3–5 relevant URLs or headlines**
based on the provided TREND_SIGNALS before proposing your final blog idea.

INSTRUCTIONS (STRICT):
1. Always invoke the Google Search tool once, using the TREND_SIGNALS as the search query.
   - Do not skip or decide; always call the tool explicitly.
   - Use a concise query (avoid full sentences).
2. After the tool returns results, analyze and synthesize them.
3. Produce a single JSON object matching the schema below:
   - "title": catchy, realistic blog title
   - "rationale": short reasoning (end with [source?])
   - "seed": core keyword from the trend
   - "sourceUrl": one best supporting URL
   - "references": list of URLs + metadata from search results
   - "timestamp": current ISO datetime

SCHEMA FIELDS:
{
  "title": "string",
  "rationale": "string",
  "seed": "string",
  "sourceUrl": "string (optional)",
  "references": [
    {
      "url": "string (required)",
      "title": "string (optional)",
      "snippet": "string (optional)"
    }
  ],
  "timestamp": "string"
}

INPUT DATA:
TREND_SIGNALS:
{{trendInput}}

RECENT_NEWS:
{{recentNews}}

OUTPUT FORMAT:
Return valid JSON matching the schema exactly — no Markdown, no commentary, no tool instructions.
`,
});
