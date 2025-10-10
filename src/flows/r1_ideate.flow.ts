import { ai } from '../clients/genkitInstance';
import { r1_ideate_input, r1_ideate_output } from '../schemas/r1_ideate.schema';
import { safeParseJsonFromAI } from '@clients/aiParsing';

console.log('[r1_ideate]      Flow module loaded');

export const r1_ideate = ai.defineFlow(
  {
    name: 'r1_ideate',
    inputSchema: r1_ideate_input,
    outputSchema: r1_ideate_output,
  },
  async (input) => {
    console.log('[r1_ideate] Flow invoked with input:', input);
    const topic = input.topic ?? input.seedPrompt ?? 'general tech trends';
    console.log('[r1_ideate] Using topic:', topic);

    const promptFn = ai.prompt('r1_ideate_prompt');
    let resp;
    try {
      resp = await promptFn({ trendInput: topic });
    } catch (err) {
      console.error('[r1_ideate] Prompt call failed:', err);
      throw new Error('Prompt execution error in r1_ideate');
    }

    // `resp` might have `.text` or `.output` depending on prompt configuration
    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) {
      console.error('[r1_ideate] No output text or parsed output', resp);
      throw new Error('Prompt returned no usable result');
    }

    let ideationObj;
    try {
      ideationObj = safeParseJsonFromAI(raw);
    } catch (err) {
      console.error('[r1_ideate] JSON parse failed', { raw, err });
      throw new Error('Failed to parse prompt output');
    }

    try {
      r1_ideate_output.parse(ideationObj);
    } catch (err) {
      console.error('[r1_ideate] Schema validation failed', { ideationObj, err });
      throw new Error('Prompt output did not match schema for r1_ideate');
    }
    if (!ideationObj.ideas || ideationObj.ideas.length === 0) {
      console.error('[r1_ideate] No ideas generated');
      throw new Error('No ideas were generated from the prompt.');
    }


    console.log('[r1_ideate] ✅ Success:', ideationObj.ideas?.length ?? 0, 'ideas generated');
    return ideationObj;
  }
);
