import {ai} from "../../clients/genkitInstance.client";
import {z} from "zod";
import {r1_ideate_prompt_output} from "../../schemas/flows/r1_ideate.schema";
import {googleSearchTool} from "@src/tools";

export const ideationPromptWithSearch = ai.definePrompt({
  name: "Round1_IdeationPrompt_With_Search",
  description: "Guaranteed Google Search tool invocation for context enrichment.",
  model: "googleai/gemini-2.5-flash",
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
    1.  Analyze the provided TREND_SIGNALS and RECENT_NEWS.
    2.  Invoke the Google Search tool with a well-formed query to find supporting articles, data, or expert opinions.
    3.  Synthesize the search results to select a single, compelling blog post idea.
    4.  Generate a title, a concise rationale (including citations from your search), and a "seed" keyword phrase.
    5.  Populate the 'references' array with the top 3 most relevant search results.
    6.  Output the result as a single, valid JSON object that adheres to the schema.
    
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
      "timestamp": "string (must be in ISO 8601 date-time format, e.g., YYYY-MM-DDTHH:mm:ss.sssZ)"
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
