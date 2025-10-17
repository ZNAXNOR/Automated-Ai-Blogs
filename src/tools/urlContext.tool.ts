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
    const normalizedUrl = typeof input === "string" ? input : input?.url;
    try {
      if (!normalizedUrl || typeof normalizedUrl !== "string") {
        throw new Error("Invalid input: expected a URL string or { url } object");
      }

      console.log(`[urlContextTool] 🟡 Invoked with: ${normalizedUrl}`);

      const ctx = await fetchUrlContext(normalizedUrl);

      // Defensive check
      if (!ctx || typeof ctx !== "object") {
        throw new Error(`Empty or invalid response for ${normalizedUrl}`);
      }

      console.log(`[urlContextTool] ✅ Success: fetched context for ${normalizedUrl}`);
      return {
        url: normalizedUrl,
        title: ctx.title || null,
        summary: ctx.description || null,
        contentType: null,
        wordCount: null,
        images: Array.isArray(ctx.images) ? ctx.images : [],
        lang: ctx.lang ?? null,
        relevance: 1,
      };
    } catch (err) {
      console.error(`[urlContextTool] ❌ Error for ${normalizedUrl}:`, err);
      return {
        url: normalizedUrl || 'invalid_url',
        title: null,
        summary: null,
        contentType: null,
        wordCount: null,
        images: [],
        lang: null,
        relevance: 0,
      };
    }
  }
);
