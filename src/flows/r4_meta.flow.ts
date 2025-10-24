import { ai } from '../clients/genkitInstance.client';
import { r4_meta_input, r4_meta_output, R4MetaOutput } from '../schemas/flows/r4_meta.schema';
import { metaPrompt } from '@src/prompts/flows/r4_meta.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing.client';

console.log(`[r4_meta]       Flow module loaded`);

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
      const resp = await metaPrompt(input, { context });

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
