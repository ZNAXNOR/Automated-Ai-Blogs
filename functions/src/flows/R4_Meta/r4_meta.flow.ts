/**
 * @file Generates metadata for the blog post, including SEO details, tags,
 * and categories.
 * @author Omkar Dalvi
 *
 * This flow (Round 4) takes the drafted blog content and generates essential
 * metadata required for publication and search engine optimization. It performs
 * the following steps:
 * 1. Fetches existing tags and categories from a WordPress instance to provide
 *    context to the AI. This helps in aligning the generated metadata with the
 *    site's existing taxonomy.
 * 2. Uses a generative AI prompt (`metaPrompt`) to create:
 *    - A compelling title and URL-friendly slug.
 *    - An SEO-optimized description and keywords.
 *    - Relevant tags and a primary category.
 *    - A suggested reading level.
 *    - Prompts for generating a featured image.
 * 3. Includes a fallback mechanism to generate basic metadata if the AI prompt
 *    fails.
 * 4. Parses and validates the generated metadata against a schema.
 * 5. Persists the final metadata object to a storage bucket.
 */

import {ai} from "../../clients/genkitInstance.client";
import {
  r4MetaInput,
  r4MetaOutput,
  R4MetaOutput,
} from "../../schemas/flows/r4_meta.schema";
import {metaPrompt} from "../../prompts/flows/r4_meta.prompt";
import {safeParseJsonFromAI} from "../../clients/aiParsing.client";
import fetch from "node-fetch";
import {round4StorageStep} from "./r4_storage.step";

console.log("[r4Meta] Flow module loaded");

/**
 * Fetches taxonomy terms (like tags or categories) from a WordPress REST API.
 * @param {string} endpoint The WordPress API URL for the taxonomy.
 * @return {Promise<string[]>} A promise that resolves to an array of term
 *     names.
 */
async function fetchWPTaxonomy(endpoint: string): Promise<string[]> {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
    }
    const data = await response.json() as { name: string }[];
    return data.map((item) => item.name).filter(Boolean);
  } catch (error) {
    console.error(
      `[r4Meta] Error fetching WordPress taxonomy from ${endpoint}:`,
      error
    );
    return []; // Return an empty array on failure to avoid breaking the flow.
  }
}

/**
 * The main flow for Round 4, responsible for generating all post metadata.
 */
export const r4Meta = ai.defineFlow(
  {
    name: "round4Meta",
    inputSchema: r4MetaInput,
    outputSchema: r4MetaOutput,
  },
  async (input) => {
    const {pipelineId, title, fullDraft, topic, tone} = input;
    console.log(
      `[r4Meta] Starting metadata generation for pipeline: ${pipelineId}`
    );
    const wordpressApiUrl = process.env.WP_API_URL;

    let finalOutput: R4MetaOutput;

    try {
      // Fetch existing tags and categories to provide context to the AI.
      // This helps the model generate relevant and consistent taxonomy terms.
      const tagsUrl =
        `${wordpressApiUrl}/wp-json/wp/v2/tags?per_page=100&_fields=name`;
      const catsUrl =
        `${wordpressApiUrl}/wp-json/wp/v2/categories?per_page=100&_fields=name`;

      const [tags, categories] = await Promise.all([
        fetchWPTaxonomy(tagsUrl),
        fetchWPTaxonomy(catsUrl),
      ]);

      const filteredCategories = categories.filter(
        (cat) => cat.toLowerCase() !== "uncategorized"
      );
      console.log(
        `[r4Meta] Fetched ${tags.length} tags and ` +
        `${filteredCategories.length} categories for context.`
      );

      // Execute the AI prompt to generate the metadata.
      const response = await metaPrompt({
        blogTitle: title,
        draftText: fullDraft,
        topic: topic,
        tone: tone,
        availableTags: tags,
        availableCategories: filteredCategories,
      });

      const rawOutput = response.text ?? JSON.stringify(response.output);
      const parsedJson = safeParseJsonFromAI(rawOutput);

      // Validate the parsed JSON against the output schema.
      finalOutput = r4MetaOutput.parse({...parsedJson, pipelineId});
      console.log(
        `[r4Meta] Successfully generated metadata for title: \
        "${finalOutput.title}"`
      );
    } catch (error) {
      console.error(
        "[r4Meta] Metadata generation failed. Using fallback.",
        error
      );
      // Fallback to basic metadata to ensure the pipeline continues.
      finalOutput = {
        pipelineId,
        title,
        slug: title.toLowerCase().replace(/\s+/g, "-").slice(0, 70),
        seoDescription: fullDraft.slice(0, 155) + "...",
        seoKeywords: [],
        tags: [],
        primaryCategory: topic ?? "General",
        readingLevel: "Intermediate",
        featuredImage: {
          type: "ai_prompt",
          description: `An illustration representing ${topic ?? title}`,
          aiPrompt: `clean vector art, ${topic ?? title}`,
        },
      };
    }

    // Persist the final metadata for subsequent rounds.
    const storageResult = await round4StorageStep(pipelineId, finalOutput);

    return {...finalOutput, __storage: storageResult};
  }
);
