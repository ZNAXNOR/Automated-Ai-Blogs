import { ai } from '../clients/genkitInstance.client';
import { r4_meta_input, r4_meta_output, R4MetaOutput } from '../schemas/flows/r4_meta.schema';
import { metaPrompt } from '@src/prompts/flows/r4_meta.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing.client';
import fetch from 'node-fetch'; // or global fetch if on Node 18+

console.log(`[r4_meta]        Flow module loaded`);

async function fetchWPData(endpoint: string): Promise<string[]> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data.map((d: any) => d.name).filter(Boolean) : [];
  } catch (err) {
    console.error(`[r4_meta] Failed to fetch ${endpoint}`, err);
    return [];
  }
}

export const r4_meta = ai.defineFlow(
  {
    name: 'Round4_Meta',
    inputSchema: r4_meta_input,
    outputSchema: r4_meta_output,
  },
  async (input, { context }) => {
    console.log({
      flow: 'r4_meta',
      stage: 'start',
      message: 'Flow invoked',
      input,
    });

    try {
      // 🔹 Fetch live WordPress tags & categories
      const [tagsList, categoriesList] = await Promise.all([
        fetchWPData('https://odlabagency.wpcomstaging.com/wp-json/wp/v2/tags?per_page=100&_fields=name'),
        fetchWPData('https://odlabagency.wpcomstaging.com/wp-json/wp/v2/categories?per_page=100&_fields=name'),
      ]);

      console.log({
        flow: 'r4_meta',
        stage: 'taxonomy_fetch',
        message: `Fetched ${tagsList.length} tags and ${categoriesList.length} categories`,
      });

      // 🔹 Run meta prompt with context
      const resp = await metaPrompt(
        {
          ...input,
          availableTags: tagsList,
          availableCategories: categoriesList,
        },
        { context }
      );

      const raw = resp.text ?? JSON.stringify(resp.output ?? {});
      console.log({
        flow: 'r4_meta',
        stage: 'prompt_response',
        message: 'Raw AI output received',
        raw,
      });

      const parsed = safeParseJsonFromAI(raw);
      r4_meta_output.parse(parsed);

      console.log({
        flow: 'r4_meta',
        stage: 'validation_success',
        message: '✅ Metadata validated successfully',
      });

      return parsed as R4MetaOutput;
    } catch (err) {
      console.error({
        flow: 'r4_meta',
        stage: 'error',
        message: 'Metadata generation failed or schema validation failed',
        error: err instanceof Error ? err.stack : String(err),
      });

      const fallback: R4MetaOutput = {
        title: input.blogTitle,
        slug: input.blogTitle.toLowerCase().replace(/\s+/g, '-').slice(0, 60),
        seoDescription: 'SEO metadata unavailable due to generation error.',
        seoKeywords: [],
        tags: [],
        primaryCategory: input.topic ?? 'General',
        readingLevel: 'Intermediate',
        featuredImage: {
          type: 'ai_prompt',
          description: 'A clean and minimal illustration representing the blog topic.',
          aiPrompt: `Illustration of concept "${input.topic ?? input.blogTitle}"`,
        },
        additionalImages: [],
      };

      console.log({
        flow: 'r4_meta',
        stage: 'fallback',
        message: 'Returning fallback metadata object',
        fallback,
      });

      return fallback;
    }
  }
);
