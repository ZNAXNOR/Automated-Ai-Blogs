import { ai, model } from '../clients/genkitInstance';
import { r5_meta_input, r5_meta_output } from '../schemas/r5_meta.schema';
import { metaPrompt } from '../prompts/r5_meta.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing';

console.log('[r5_meta] Flow module loaded');

export const r5_meta = ai.defineFlow(
  {
    name: 'r5_meta',
    inputSchema: r5_meta_input,
    outputSchema: r5_meta_output,
  },
  async (input) => {
    console.log('[r5_meta] Flow invoked', {
      totalSections: input.polished?.length ?? 0,
    });

    // Serialize polished content for the model
    const polishedJson = JSON.stringify(input.polished, null, 2);
    const promptText = metaPrompt.replace('{{POLISHED}}', polishedJson);

    console.log('[r5_meta] Preparing generation with parameters', {
      model,
      temperature: 0.55,
      tokenLimit: 2048,
    });

    let resp;
    try {
      resp = await ai.generate({
        prompt: promptText,
        model,
        config: {
          temperature: 0.55, // slightly creative for SEO copy & image prompts
          maxOutputTokens: 2048,
        },
      });
    } catch (err) {
      console.error('[r5_meta] Generation failed', err);
      throw new Error('Generation failed in r5_meta');
    }

    console.log('[r5_meta] Raw output (first 300 chars):', resp.text.slice(0, 300));

    let metaObj;
    try {
      metaObj = safeParseJsonFromAI(resp.text);
    } catch (err) {
      console.error('[r5_meta] JSON parse error', {
        rawSnippet: resp.text.slice(0, 500),
        error: err,
      });
      throw new Error('Failed to parse model output in r5_meta');
    }

    // Normalize alternate nesting
    if (metaObj.meta) {
      metaObj.title = metaObj.meta.seoTitle ?? metaObj.meta.title;
      metaObj.seoDescription = metaObj.meta.metaDescription;
      metaObj.slug = metaObj.meta.slug;
      metaObj.tags = metaObj.meta.tags;
}

    try {
      r5_meta_output.parse(metaObj);
    } catch (err) {
      console.error('[r5_meta] Schema validation failed', { parsed: metaObj, error: err });
      throw new Error('Output validation failed for r5_meta');
    }

    console.log('[r5_meta] Successfully generated metadata', {
      title: metaObj.title,
      slug: metaObj.slug,
      tags: metaObj.tags?.slice(0, 5) ?? [],
      imagePromptCount: metaObj.images?.length ?? 0,
    });

    return metaObj;
  }
);
