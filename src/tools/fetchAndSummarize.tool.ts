import { googleSearchTool } from "./googleSearch.tool";
import { urlContextTool } from "./urlContext.tool";
import { ai } from "../clients/genkitInstance.client";
import { fetchAndSummarizeInputSchema, fetchAndSummarizeOutputSchema } from "../schemas/tools/fetchAndSummarize.schema";

export const fetchAndSummarizeTool = ai.defineTool(
  {
    name: "Genkit_FetchAndSummarize",
    description: "Given a query, search and fetch context for the top result, then return summary.",
    inputSchema: fetchAndSummarizeInputSchema,
    outputSchema: fetchAndSummarizeOutputSchema,
  },
  async (input) => {
    console.log('[fetchAndSummarizeTool] Tool invoked with input:', input);
    const results = await googleSearchTool(input); // note: Genkit will simulate tool call resolution
    if (!results || results.length === 0) {
      console.log('[fetchAndSummarizeTool] No results from googleSearchTool');
      return {
        query: input.query,
        topResult: { title: "", snippet: "", url: "" },
        context: { images: [] },
      };
    }
    const top = results[0];
    const ctx = await urlContextTool({ url: top.url });
    const output = {
      query: input.query,
      topResult: {
        title: top.title,
        snippet: top.snippet,
        url: top.url,
      },
      context: {
        title: ctx.title,
        description: ctx.description,
        text: ctx.text,
        images: ctx.images,
      },
    };
    console.log('[fetchAndSummarizeTool] ✅ Success:', { query: input.query, url: top.url });
    return output;
  }
);
