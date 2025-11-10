import { search } from "../clients/google/googleSearch.client.js";
import { ai } from "../clients/genkitInstance.client.js";
import { googleSearchInputSchema, googleSearchOutputSchema } from "../schemas/tools/googleSearch.schema.js";
import { GOOGLE_CSE_API_KEY_CONFIG, GOOGLE_CSE_CX_CONFIG, SERPAPI_KEY_SECRET } from "@src/config.js";

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
      cseKey: GOOGLE_CSE_API_KEY_CONFIG.value(),
      cseCx: GOOGLE_CSE_CX_CONFIG.value(),
      serpApiKey: SERPAPI_KEY_SECRET.value(),
    });
    console.log(`[googleSearchTool] ✅ Success, found ${results.length} results for query: \"${query}\"`);
    return results;
  }
);
