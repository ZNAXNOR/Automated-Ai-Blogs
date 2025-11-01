import { ai } from '../clients/genkitInstance.client';
import { r4_meta_input, r4_meta_output, R4MetaOutput } from '../schemas/flows/r4_meta.schema';
import { metaPrompt } from '@src/prompts/flows/r4_meta.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing.client';
import fetch from 'node-fetch'; // or global fetch if on Node 18+
import { persistRoundOutput } from '../adapters/roundStorage.adapter';

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

    const WordPressWebsite = process.env.WP_API_URL;

    try {
      // 🔹 Fetch live WordPress tags & categories
      const [tagsList, categoriesList] = await Promise.all([
        fetchWPData(`${WordPressWebsite}/wp-json/wp/v2/tags?per_page=100&_fields=name`),
        fetchWPData(`${WordPressWebsite}/wp-json/wp/v2/categories?per_page=100&_fields=name`),
      ]);

      const filteredCategories = categoriesList.filter(
        (cat) => cat.toLowerCase() !== 'uncategorized'
      );

      console.log({
        flow: 'r4_meta',
        stage: 'taxonomy_fetch',
        message: `Fetched ${tagsList.length} tags and ${filteredCategories.length} filtered categories`,
      });

      // 🔹 Run meta prompt with context
      const resp = await metaPrompt(
        {
          blogTitle: input.title,
          draftText: input.fullDraft,
          topic: input.topic,
          tone: input.tone,
          availableTags: tagsList,
          availableCategories: filteredCategories,
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
      parsed.pipelineId = input.pipelineId;
      r4_meta_output.parse(parsed);

      console.log({
        flow: 'r4_meta',
        stage: 'validation_success',
        message: '✅ Metadata validated successfully',
      });

      // Inline subflow — Round4_Storage
      const storageResult = await ai.run('Round4_Storage', async () => {
        const { additionalImages, status, readingLevel, ...storageData } = parsed as any;
        const args = { pipelineId: parsed.pipelineId, round: 'r4', data: storageData, inputMeta: input };
        const { pipelineId: pId, round, data } = args;
        const startedAt = new Date().toISOString();

        try {
            const persistResult = await persistRoundOutput(pId, round, data);
            return {
                ok: true,
                pipelineId: pId,
                round,
                persistResult,
                startedAt,
                finishedAt: new Date().toISOString(),
            };
        } catch (err) {
            console.error(`[r4_meta:Round4_Storage] persistRoundOutput failed:`, err);
            const errorMessage = err instanceof Error ? err.stack : String(err);
            return {
                ok: false,
                pipelineId: pId,
                round,
                error: errorMessage,
                startedAt,
                finishedAt: new Date().toISOString(),
            };
        }
      });
      
      console.log({
        flow: 'r4_meta',
        stage: 'storage_complete',
        message: '✅ Storage operation completed',
        pipelineId: parsed.pipelineId,
        gcsPath: storageResult?.persistResult?.gcsPath,
      });

      const finalOutput = {
          ...parsed,
          __storage: storageResult,
      };

      return finalOutput;

    } catch (err) {
      console.error({
        flow: 'r4_meta',
        stage: 'error',
        message: 'Metadata generation failed or schema validation failed',
        error: err instanceof Error ? err.stack : String(err),
      });

      const fallback: R4MetaOutput = {
        pipelineId: input.pipelineId,
        title: input.title,
        slug: input.title.toLowerCase().replace(/\s+/g, '-').slice(0, 60),
        seoDescription: 'SEO metadata unavailable due to generation error.',
        seoKeywords: [],
        tags: [],
        primaryCategory: input.topic ?? 'General',
        readingLevel: 'Intermediate',
        featuredImage: {
          type: 'ai_prompt',
          description: 'A clean and minimal illustration representing the blog topic.',
          aiPrompt: `Illustration of concept "${input.topic ?? input.title}"`,
        },
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
