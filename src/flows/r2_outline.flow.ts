import { ai } from '../clients/genkitInstance';
import { r2_outline_input, r2_outline_output } from '../schemas/r2_outline.schema';
import { safeParseJsonFromAI } from '../clients/aiParsing';

console.log('[r2_outline]     Flow module loaded');

export const r2_outline = ai.defineFlow(
  {
    name: 'r2_outline',
    inputSchema: r2_outline_input,
    outputSchema: r2_outline_output,
  },
  async (input) => {
    console.log('[r2_outline] Flow invoked with input:', input);
    const topicIdea = input.idea ?? [];
    console.log('[r2_outline] Using topicIdea count:', topicIdea.length);

    const promptFn = ai.prompt('r2_outline_prompt');
    let resp;
    try {
      resp = await promptFn({ topicIdea });
    } catch (err) {
      console.error('[r2_outline] Prompt call failed:', err);
      throw new Error('Prompt execution error in r2_outline');
    }

    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) {
      console.error('[r2_outline] No usable output', resp);
      throw new Error('Prompt returned no usable result');
    }

    let outlineObj;
    try {
      outlineObj = safeParseJsonFromAI(raw);
    } catch (err) {
      console.error('[r2_outline] JSON parse failed', { raw, err });
      throw new Error('Failed to parse prompt output');
    }

    try {
      r2_outline_output.parse(outlineObj);
    } catch (err) {
      console.error('[r2_outline] Schema validation failed', { outlineObj, err });
      throw new Error('Prompt output did not match schema for r2_outline');
    }

    if (!outlineObj.outline.sections || outlineObj.outline.sections.length === 0) {
      console.error('[r2_outline] No sections generated');
      throw new Error('No sections were generated from the prompt.');
    }

    console.log('[r2_outline] ✅ Success:', outlineObj.outline.sections?.length ?? 0, 'sections generated');
    return outlineObj;
  }
);
