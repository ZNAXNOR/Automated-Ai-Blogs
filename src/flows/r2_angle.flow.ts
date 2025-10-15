import { ai } from '../clients/genkitInstance.client';
import { r2_angle_input, r2_angle_output } from '../schemas/flows/r2_angle.schema';
import { safeParseJsonFromAI } from '../clients/aiParsing.client';

console.log('[r2_angle]       Flow module loaded');

export const r2_angle = ai.defineFlow(
  {
    name: 'Round2_Angle',
    inputSchema: r2_angle_input,
    outputSchema: r2_angle_output,
  },
  async (input) => {
    console.log('[r2_angle] Flow invoked with input:', input);
    const topicIdea = input.idea ?? [];
    console.log('[r2_angle] Using topicIdea count:', topicIdea.length);

    const promptFn = ai.prompt('Round2_AnglePrompt');
    let resp;
    try {
      resp = await promptFn({ topicIdea });
    } catch (err) {
      console.error('[r2_angle] Prompt call failed:', err);
      throw new Error('Prompt execution error in r2_angle');
    }

    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) {
      console.error('[r2_angle] No usable output', resp);
      throw new Error('Prompt returned no usable result');
    }

    let outlineObj;
    try {
      outlineObj = safeParseJsonFromAI(raw);
    } catch (err) {
      console.error('[r2_angle] JSON parse failed', { raw, err });
      throw new Error('Failed to parse prompt output');
    }

    try {
      r2_angle_output.parse(outlineObj);
    } catch (err) {
      console.error('[r2_angle] Schema validation failed', { outlineObj, err });
      throw new Error('Prompt output did not match schema for r2_angle');
    }

    if (!outlineObj.outline.sections || outlineObj.outline.sections.length === 0) {
      console.error('[r2_angle] No sections generated');
      throw new Error('No sections were generated from the prompt.');
    }

    console.log('[r2_angle] ✅ Success:', outlineObj.outline.sections?.length ?? 0, 'sections generated');
    return outlineObj;
  }
);
