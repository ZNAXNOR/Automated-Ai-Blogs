import { ai } from '../clients/genkitInstance';
import { r4_polish_input, r4_polish_output } from '../schemas/r4_polish.schema';
import { safeParseJsonFromAI } from '../clients/aiParsing';
import { brandVoice } from '../../prompts/r4_polish.prompt';

console.log('[r4_polish] Flow module loaded');

export const r4_polish = ai.defineFlow(
  {
    name: 'r4_polish',
    inputSchema: r4_polish_input,
    outputSchema: r4_polish_output,
  },
  async (input) => {
    console.log('[r4_polish] Flow invoked with draft', {
      draftSections: input.draft?.length ?? 0,
    });

    const promptFn = ai.prompt('r4_polish_prompt');
    let resp;
    try {
        resp = await promptFn({
            sectionDraft: input.draft,
            brandVoice: brandVoice,
        });
    } catch (err) {
      console.error('[r4_polish] Prompt call failed', err);
      throw new Error('Prompt execution error in r4_polish');
    }

    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) {
      console.error('[r4_polish] No usable output', resp);
      throw new Error('Prompt returned no usable result');
    }

    console.log('[r4_polish] Raw output (first 300 chars):', raw.slice(0, 300));

    let polishObj;
    try {
      polishObj = safeParseJsonFromAI(raw);
    } catch (err) {
      console.error('[r4_polish] JSON parse error', {
        rawSnippet: raw.slice(0, 500),
        error: err,
      });
      throw new Error('Failed to parse model output in r4_polish');
    }

    if (Array.isArray(polishObj)) {
      polishObj = { polished: polishObj };
    }

    try {
      r4_polish_output.parse(polishObj);
    } catch (err) {
      console.error('[r4_polish] Schema validation failed', { parsed: polishObj, error: err });
      throw new Error('Output validation failed for r4_polish');
    }
    
    console.log('[r4_polish] ✅ Success:', polishObj.polished?.length ?? 0, 'sections polished');
    return polishObj;
  }
);
