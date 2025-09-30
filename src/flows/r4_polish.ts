import { ai, model } from '../clients/genkitInstance';
import { r4_polish_input, r4_polish_output } from '../schemas/r4_polish.schema';
import { polishPrompt, brandVoice } from '../prompts/r4_polish.prompt';

export const r4_polish = ai.defineFlow(
  {
    name: 'r4_polish',
    inputSchema: r4_polish_input,
    outputSchema: r4_polish_output,
  },
  async (input) => {
    // Safely resolve topic/seed
    const outlineInput = input.draft

    // Replace placeholder in the prompt
    const promptText = polishPrompt.replace('{{BRAND_VOICE}}', brandVoice).replace('{{SECTION_DRAFT}}', outlineInput);
  
    const resp = await ai.generate({
      prompt: promptText,
      model,
      config: {
        temperature: 0.7,
      },
    });
    
    return {
      polished: resp.text,
    };
  }
);
console.log('Loading r4_polish flow definition');