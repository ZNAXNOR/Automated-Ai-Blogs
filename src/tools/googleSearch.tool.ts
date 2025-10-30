import { search } from "../clients/google/googleSearch.client";
import { ai } from "../clients/genkitInstance.client";
import { googleSearchInputSchema, googleSearchOutputSchema } from "../schemas/tools/googleSearch.schema";

export const googleSearchTool = ai.defineTool(
  {
    name: "Genkit_GoogleSearch",
    description: "Search Google (via CSE / SerpApi) and return a list of results",
    inputSchema: googleSearchInputSchema,
    outputSchema: googleSearchOutputSchema,
  },
  async (input) => {
    console.log('[googleSearchTool] Tool invoked with input:', input);
    const { query, num } = input;
    const results = await search(query, {
      num,
      cseKey: process.env.GOOGLE_CSE_API_KEY,
      cseCx: process.env.GOOGLE_CSE_CX,
      serpApiKey: process.env.SERPAPI_KEY,
    });
    console.log(`[googleSearchTool] ✅ Success, found ${results.length} results for query: "${query}"`);
    return results;
  }
);
