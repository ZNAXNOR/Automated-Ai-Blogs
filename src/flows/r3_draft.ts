import { ai, model } from '../clients/genkitInstance';
import { r3_draft_input, r3_draft_output } from '../schemas/r3_draft.schema';
import { draftPrompt } from '../prompts/r3_draft.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing';

console.log('[r3_draft] Flow module loaded');

export const r3_draft = ai.defineFlow(
  {
    name: 'r3_draft',
    inputSchema: r3_draft_input,
    outputSchema: r3_draft_output,
  },
  async (input) => {
    console.log('[r3_draft] Flow invoked with input outline:', {
      title: input.outline?.title,
      sectionCount: input.outline?.sections?.length ?? 0,
    });

    const outlineJson = JSON.stringify(input.outline, null, 2);
    const promptText = draftPrompt.replace('{{OUTLINE}}', outlineJson);

    console.log('[r3_draft] Preparing generation with parameters', {
      model,
      temperature: 0.45,
      tokenLimit: 4096,
    });

    let resp;
    try {
      resp = await ai.generate({
        prompt: promptText,
        model,
        config: {
          temperature: 0.45, // balanced creative drafting
          maxOutputTokens: 4096,
        },
      });
    } catch (err) {
      console.error('[r3_draft] Generation failed:', err);
      throw new Error('Generation failed in r3_draft');
    }

    console.log('[r3_draft] Raw output (first 300 chars):', resp.text.slice(0, 300));

    let draftObj;
    try {
      draftObj = safeParseJsonFromAI(resp.text);
    } catch (err) {
      console.error('[r3_draft] JSON parse failed', {
        rawSnippet: resp.text.slice(0, 500),
        error: err,
      });
      throw new Error('Failed to parse model output in r3_draft');
    }

    // If AI returned an array, wrap it properly
    if (Array.isArray(draftObj)) {
      draftObj = { draft: draftObj };
    }

    try {
      r3_draft_output.parse(draftObj);
    } catch (err) {
      console.error('[r3_draft] Schema validation failed', { parsed: draftObj, error: err });
      throw new Error('Output validation failed for r3_draft');
    }

    console.log('[r3_draft] Successfully validated draft', {
      totalSections: draftObj.draft?.length ?? 0,
      firstSectionId: draftObj.draft?.[0]?.sectionId ?? 'N/A',
    });

    return draftObj;
  }
);
