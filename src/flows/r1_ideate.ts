import { ai, model } from '../clients/genkitInstance';
import { r1_ideate_input, r1_ideate_output } from '../schemas/r1_ideate.schema';
import { ideationPrompt } from '../prompts/r1_ideate.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing';

console.log('[r1_ideate] Flow module loaded');

export const r1_ideate = ai.defineFlow(
  {
    name: 'r1_ideate',
    inputSchema: r1_ideate_input,
    outputSchema: r1_ideate_output,
  },
  async (input) => {
    console.log('[r1_ideate] Flow invoked with input:', input);

    const trendInput = input.topic ?? input.seedPrompt ?? 'general tech trends';
    const promptText = ideationPrompt.replace('{{TREND_INPUT}}', trendInput);

    console.log('[r1_ideate] Preparing generation with parameters', {
      topic: trendInput,
      model,
      temperature: 0.2,
    });

    let llmResponse;
    try {
      llmResponse = await ai.generate({
        prompt: promptText,
        model,
        config: {
          temperature: 0.2, // baked-in deterministic creativity
          maxOutputTokens: 1024,
        },
      });
    } catch (err) {
      console.error('[r1_ideate] Generation error:', err);
      throw new Error('Generation failed in r1_ideate');
    }

    console.log('[r1_ideate] Raw model output (first 300 chars):', llmResponse.text.slice(0, 300));

    let ideateObj;
    try {
      ideateObj = safeParseJsonFromAI(llmResponse.text);
    } catch (err) {
      console.error('[r1_ideate] JSON parse failed', {
        rawOutputSnippet: llmResponse.text.slice(0, 500),
        error: err,
      });
      throw new Error('Failed to parse LLM output to JSON in r1_ideate');
    }

    try {
      r1_ideate_output.parse(ideateObj);
    } catch (err) {
      console.error('[r1_ideate] Schema validation failed', { parsed: ideateObj, error: err });
      throw new Error('Output validation failed for r1_ideate');
    }

    console.log('[r1_ideate] Successfully validated output. Returning:', {
      ideasCount: ideateObj.ideas?.length ?? 0,
    });

    return ideateObj;
  }
);
