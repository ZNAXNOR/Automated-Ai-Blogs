import { fetchUrlContext } from "../clients/urlFetcher.client";
import { ai } from "../clients/genkitInstance.client";
import { urlContextInputSchema, urlContextOutputSchema } from "../schemas/tools/urlContext.schema";

export const urlContextTool = ai.defineTool(
  {
    name: "Genkit_FetchUrlContext",
    description: "Fetch a URL and return metadata (title, snippet, images, etc.)",
    inputSchema: urlContextInputSchema,
    outputSchema: urlContextOutputSchema,
  },
  async (input) => {
    console.log('[urlContextTool] Tool invoked with url:', input.url);
    const ctx = await fetchUrlContext(input.url);
    console.log(`[urlContextTool] ✅ Success, fetched context for: ${input.url}`);
    return ctx;
  }
);
