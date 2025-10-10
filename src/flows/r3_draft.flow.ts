import { ai } from '../clients/genkitInstance';
import { r3_draft_input, r3_draft_output } from '../schemas/r3_draft.schema';
import { safeParseJsonFromAI } from '../clients/aiParsing';

console.log('[r3_draft]       Flow module loaded');

export const r3_draft = ai.defineFlow(
  {
    name: 'r3_draft',
    inputSchema: r3_draft_input,
    outputSchema: r3_draft_output,
  },
  async (input) => {
    console.log('[r3_draft] Flow invoked with outline:', {
      title: input.outline?.title,
      sectionCount: input.outline?.sections?.length ?? 0,
    });

    const promptFn = ai.prompt('r3_draft_prompt');
    let resp;
    try {
      resp = await promptFn({ outline: input.outline.sections });
    } catch (err) {
      console.error('[r3_draft] Prompt call failed:', err);
      throw new Error('Prompt execution error in r3_draft');
    }

    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) {
      console.error('[r3_draft] No usable output', resp);
      throw new Error('Prompt returned no usable result');
    }

    let draftObj;
    try {
      draftObj = safeParseJsonFromAI(raw);
    } catch (err) {
      console.error('[r3_draft] JSON parse failed', { raw, err });
      throw new Error('Failed to parse prompt output');
    }

    if (Array.isArray(draftObj)) {
      draftObj = { draft: draftObj };
    }

    try {
      r3_draft_output.parse(draftObj);
    } catch (err) {
      console.error('[r3_draft] Schema validation failed', { draftObj, err });
      throw new Error('Prompt output did not match schema for r3_draft');
    }

    if (!draftObj.draft || draftObj.draft.length === 0) {
      console.error('[r3_draft] No draft generated');
      throw new Error('No draft was generated from the prompt.');
    }

    console.log('[r3_draft] ✅ Success:', draftObj.draft?.length ?? 0, 'sections drafted');
    return draftObj;
  }
);
