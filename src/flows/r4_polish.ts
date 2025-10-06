import { ai, model } from '../clients/genkitInstance';
import { r4_polish_input, r4_polish_output } from '../schemas/r4_polish.schema';
import { polishPrompt, brandVoice } from '../prompts/r4_polish.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing';

console.log('[r4_polish] Flow module loaded');

export const r4_polish = ai.defineFlow(
  {
    name: 'r4_polish',
    inputSchema: r4_polish_input,
    outputSchema: r4_polish_output,
  },
  async (input) => {
    console.log('[r4_polish] Flow invoked', {
      draftSections: input.draft?.length ?? 0,
      brandVoice: brandVoice?.slice(0, 100) + '...',
    });

    const draftJson = JSON.stringify(input.draft, null, 2);

    const promptText = polishPrompt
      .replace('{{BRAND_VOICE}}', brandVoice)
      .replace('{{SECTION_DRAFT}}', draftJson);

    console.log('[r4_polish] Preparing generation with parameters', {
      model,
      temperature: 0.35,
      tokenLimit: 4096,
    });

    let resp;
    try {
      resp = await ai.generate({
        prompt: promptText,
        model,
        config: {
          temperature: 0.35, // light creativity for tone adjustments
          maxOutputTokens: 4096,
        },
      });
    } catch (err) {
      console.error('[r4_polish] Generation failed', err);
      throw new Error('Generation failed in r4_polish');
    }

    console.log('[r4_polish] Raw output (first 300 chars):', resp.text.slice(0, 300));

    let polishObj;
    try {
      polishObj = safeParseJsonFromAI(resp.text);
    } catch (err) {
      console.error('[r4_polish] JSON parse error', {
        rawSnippet: resp.text.slice(0, 500),
        error: err,
      });
      throw new Error('Failed to parse model output in r4_polish');
    }

    // If AI returned an array, wrap it properly
    if (Array.isArray(polishObj)) {
      polishObj = { polished: polishObj };
    }

    try {
      r4_polish_output.parse(polishObj);
    } catch (err) {
      console.error('[r4_polish] Schema validation failed', { parsed: polishObj, error: err });
      throw new Error('Output validation failed for r4_polish');
    }

    console.log('[r4_polish] Successfully validated polished draft', {
      totalSections: polishObj.polished?.length ?? 0,
      avgReadability:
        polishObj.polished?.reduce((acc: number, p: { readability?: { fkGrade?: number } }) => acc + (p.readability?.fkGrade ?? 0), 0) /
          (polishObj.polished?.length || 1) || 'N/A',
    });

    return polishObj;
  }
);
