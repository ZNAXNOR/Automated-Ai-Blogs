// src/flows/r6_coherence.flow.ts
import { ai } from '../clients/genkitInstance';
import { r6_coherence_input, r6_coherence_output } from '../schemas/r6_coherence.schema';
import { safeParseJsonFromAI } from '../clients/aiParsing';

console.log('[r6_coherence] Flow module loaded');

export const r6_coherence = ai.defineFlow(
  {
    name: 'r6_coherence',
    inputSchema: r6_coherence_input,
    outputSchema: r6_coherence_output,
  },
  async (input) => {
    console.log('[r6_coherence] Flow invoked with input', {
      polishedSections: input.polished?.length ?? 0,
      titlePresent: !!input.title,
      seoDescriptionLength: input.seoDescription?.length ?? 0,
      tagCount: Array.isArray(input.tags) ? input.tags.length : 0,
    });

    const promptFn = ai.prompt('r6_coherence_prompt');
    let resp;
    try {
      resp = await promptFn({
        title: input.title ?? '',
        seoDescription: input.seoDescription ?? '',
        tags: input.tags ?? [],
        polished: input.polished ?? [],
      });
    } catch (err) {
      console.error('[r6_coherence] ❌ Prompt call failed', err);
      throw new Error('Prompt execution error in r6_coherence');
    }

    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) {
      console.error('[r6_coherence] No usable model output', resp);
      throw new Error('Prompt returned no usable output for r6_coherence');
    }

    console.log('[r6_coherence] Raw model output (first 300 chars):', raw.slice(0, 300));

    // ---- Parse + validate ----
    let coherenceObj;
    try {
      coherenceObj = safeParseJsonFromAI(raw);
    } catch (err) {
      console.error('[r6_coherence] ❌ JSON parse error', {
        rawSnippet: raw.slice(0, 500),
        error: err,
      });
      throw new Error('Failed to parse model output in r6_coherence');
    }

    try {
      r6_coherence_output.parse(coherenceObj);
    } catch (err) {
      console.error('[r6_coherence] ❌ Schema validation failed', {
        parsed: coherenceObj,
        error: err,
      });
      throw new Error('Output validation failed for r6_coherence');
    }

    // ---- Success summary ----
    console.log('[r6_coherence] ✅ Success');
    console.log('  • Overall Score:', coherenceObj.overall);
    console.log('  • Duplicates:', coherenceObj.duplicates?.length ?? 0);
    console.log('  • Notes count:', coherenceObj.notes?.length ?? 0);

    return coherenceObj;
  }
);
