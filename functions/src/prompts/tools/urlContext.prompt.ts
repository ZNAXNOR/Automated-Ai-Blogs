import { ai } from '@clients/genkitInstance.client.js';
import { urlContextTool } from '@src/tools/urlContext.tool.js';
import { z } from 'zod';

/**
 * UrlContextPrompt
 * ---------------
 * Fetches and summarizes factual page content for a given URL.
 * Always uses urlContextTool.
 * Summaries must describe the *purpose* of the page — not generic text.
 * Absolutely no hallucination or invention.
 */

export const urlContextPrompt = ai.definePrompt({
  name: 'UrlContextPrompt',
  description: 'Fetches factual content summaries from a URL for grounding later flows.',
  model: 'googleai/gemini-2.0-flash',
  tools: [urlContextTool],

  input: {
    schema: z.object({
      url: z.string().url(),
    }),
  },

  output: {
    schema: z.object({
      url: z.string().url(),
      title: z.string().optional(),
      summary: z.string(),
      contentType: z.string().optional(),
      wordCount: z.number().optional(),
    }),
  },

  prompt: `
SYSTEM:
You are a precise, factual web summarization assistant.
Your goal is to **identify the purpose and factual content** of a web page.

MANDATORY STEPS:
1. Use the urlContext tool to retrieve the actual page text from the given URL.
2. Identify the purpose of the page (e.g. sales page, documentation, blog post, comparison guide, etc.).
3. Write a **2–3 sentence factual summary** focused on:
   - The main topic or goal of the page.
   - What the page helps users do or understand.
   - What type of content it contains (tutorial, product info, research, etc.).
4. Provide an approximate word count if available.
5. Do NOT invent or guess — only report what exists on the page.

OUTPUT STRICTLY IN THIS FORMAT:
{
  "url": "<url>",
  "title": "<factual page title>",
  "summary": "<2–3 factual sentences on the page's purpose and content>",
  "contentType": "<article|blog|product|guide|tool|other>",
  "wordCount": <approx int>
}

Now process:
{{url}}
  `,
});
