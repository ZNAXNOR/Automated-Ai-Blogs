import { ai, model } from '../clients/genkitInstance';
import { r1_ideate_input, r1_ideate_output } from '../schemas/r1_ideate.schema';
import { ideationPrompt } from '../prompts/r1_ideate.prompt';

export const r1_ideate = ai.defineFlow(
  {
    name: 'r1_ideate',
    inputSchema: r1_ideate_input,
    outputSchema: r1_ideate_output,
  },
  async (input) => {
    // Safely resolve topic/seed
    const trendInput = input.topic ?? input.seedPrompt ?? 'general tech trends';

    // Replace placeholder in the prompt
    const promptText = ideationPrompt.replace('{{TREND_INPUT}}', trendInput);

    const llmResponse = await ai.generate({
      prompt: promptText,
      model,
      config: {
        temperature: 1,
      },
    });

    // Minimal parsing: split lines into array
    const lines = llmResponse.text.split('\n').filter(Boolean);

    return {
      ideas: lines,
    };
  }
);

console.log('Loading r1_ideate flow definition');
