import { ai } from '../clients/genkitInstance.client';
import { r5_meta_input, r5_meta_output } from '../schemas/flows/r5_meta.schema';
import { safeParseJsonFromAI } from '../clients/aiParsing.client';

console.log('[r5_meta]        Flow module loaded');

export const r5_meta = ai.defineFlow(
  {
    name: 'Round5_Metadata',
    inputSchema: r5_meta_input,
    outputSchema: r5_meta_output,
  },
  async (input) => {
    console.log('[r5_meta] Flow invoked with polish', {
      totalSections: input.polished?.length ?? 0,
    });

    const promptFn = ai.prompt('Round5_MetadataPrompt');
    let resp;
    try {
      resp = await promptFn({
        polished: input.polished,
      });
    } catch (err) {
      console.error('[r5_meta] Prompt call failed', err);
      throw new Error('Prompt execution error in r5_meta');
    }

    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) {
      console.error('[r5_meta] No usable output', resp);
      throw new Error('Prompt returned no usable result');
    }

    console.log('[r5_meta] Raw output (first 300 chars):', raw.slice(0, 300));

    let metaObj;
    try {
      metaObj = safeParseJsonFromAI(raw);
    } catch (err) {
      console.error('[r5_meta] JSON parse error', {
        rawSnippet: raw.slice(0, 500),
        error: err,
      });
      throw new Error('Failed to parse model output in r5_meta');
    }

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

    if (!metaObj.title || !metaObj.seoDescription || !metaObj.slug) {
      console.error('[r5_meta] Empty metadata generated');
      throw new Error('Empty metadata was generated from the prompt.');
    }

    console.log('[r5_meta] ✅ Success: metadata generated for', metaObj.title);
    return metaObj;
  }
);
