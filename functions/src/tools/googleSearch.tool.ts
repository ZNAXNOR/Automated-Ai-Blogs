import {search} from "../clients/google/googleSearch.client.js";
import {ai} from "../clients/genkitInstance.client.js";
import {
  googleSearchInputSchema,
  googleSearchOutputSchema,
} from "../schemas/tools/googleSearch.schema.js";
import { defineSecret } from "firebase-functions/params";
import { GOOGLE_CSE_CX_CONFIG } from "@src/index.js";

export const googleSearchTool = ai.defineTool(
  {
    name: "Genkit_GoogleSearch",
    description: "Search Google and return a list of results",
    inputSchema: googleSearchInputSchema,
    outputSchema: googleSearchOutputSchema,
  },
  async (input) => {
    console.log("[googleSearchTool] Tool invoked with input:", input);
    const {query, num} = input;
    require('dotenv').config({ path: '../../.env.blogwebsite-2004' });
    const results = await search(query, {
      num,
      cseKey: process.env.GOOGLE_CSE_API_KEY,
      cseCx: GOOGLE_CSE_CX_CONFIG.value(),
      serpApiKey: defineSecret("SERPAPI_KEY").value(),
    });
    console.log(
      `[googleSearchTool] ✅ Success, found ${results.length} results for 
        query: "${query}"`
    );
    return results;
  }
);
