import { ai, model } from '../clients/genkitInstance';
import { r2_outline_input, r2_outline_output } from '../schemas/r2_outline.schema';
import { outlinePrompt } from '../prompts/r2_outline.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing';

console.log('[r2_outline] Flow module loaded');

export const r2_outline = ai.defineFlow(
  {
    name: 'r2_outline',
    inputSchema: r2_outline_input,
    outputSchema: r2_outline_output,
  },
  async (input) => {
    console.log('[r2_outline] Flow invoked with input:', input);

    const ideaInput = input.idea ?? [];
    const ideaJson = JSON.stringify(ideaInput, null, 2);
    const promptText = outlinePrompt.replace('{{TOPIC_IDEA}}', ideaJson);

    console.log('[r2_outline] Preparing generation with parameters', {
      ideaCount: ideaInput.length,
      model,
      temperature: 0.35,
    });

    let resp;
    try {
      resp = await ai.generate({
        prompt: promptText,
        model,
        config: {
          temperature: 0.35, // baked-in balanced creativity
          maxOutputTokens: 2048,
        },
      });
    } catch (err) {
      console.error('[r2_outline] Generation error:', err);
      throw new Error('Generation failed in r2_outline');
    }

    console.log('[r2_outline] Raw output (first 300 chars):', resp.text.slice(0, 300));

    let outlineObj;
    try {
      outlineObj = safeParseJsonFromAI(resp.text);
    } catch (err) {
      console.error('[r2_outline] JSON parse failed', {
        rawOutputSnippet: resp.text.slice(0, 500),
        error: err,
      });
      throw new Error('Failed to parse LLM output to JSON in r2_outline');
    }

    if (!outlineObj.outline && outlineObj.title && outlineObj.sections) {
      outlineObj = { outline: outlineObj };
    }

    try {
      r2_outline_output.parse(outlineObj);
    } catch (err) {
      console.error('[r2_outline] Schema validation failed', { 
        parsed: outlineObj, error: err 
      });
      throw new Error('Output validation failed for r2_outline');
    }

    console.log('[r2_outline] Successfully validated output. Returning:', {
      sectionsCount: outlineObj.outline?.sections?.length ?? 0,
      title: outlineObj.outline?.title ?? 'Untitled',
    });

    return outlineObj;
  }
);
