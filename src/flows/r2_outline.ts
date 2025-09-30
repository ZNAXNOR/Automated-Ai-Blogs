import { ai, model } from '../clients/genkitInstance';
import { r2_outline_input, r2_outline_output } from '../schemas/r2_outline.schema';
import { outlinePrompt } from '../prompts/r2_outline.prompt';

export const r2_outline = ai.defineFlow(
  {
    name: 'r2_outline',
    inputSchema: r2_outline_input,
    outputSchema: r2_outline_output,
  },
  async (input) => {
    // Safely resolve topic/seed
    const ideaInput = input.idea

    // Replace placeholder in the prompt
    const promptText = outlinePrompt.replace('{{TOPIC_IDEA}}', ideaInput.join('\n'));

    const resp = await ai.generate({
      prompt: promptText,
      model,
      config: {
        temperature: 0.8,
      },
    });

    return {
      outline: resp.text,
    };
  }
);
console.log('Loading r2_outline flow definition');