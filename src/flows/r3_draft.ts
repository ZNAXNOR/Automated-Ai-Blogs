import { ai, model } from '../clients/genkitInstance';
import { r3_draft_input, r3_draft_output } from '../schemas/r3_draft.schema';
import { draftPrompt } from '../prompts/r3_draft.prompt';

export const r3_draft = ai.defineFlow(
  {
    name: 'r3_draft',
    inputSchema: r3_draft_input,
    outputSchema: r3_draft_output,
  },
  async (input) => {
    // Safely resolve topic/seed
    const outlineInput = input.outline

    // Replace placeholder in the prompt
    const promptText = draftPrompt.replace('{{OUTLINE}}', outlineInput);

    const resp = await ai.generate({
      prompt: promptText,
      model,
      config: {
        temperature: 0.9,
      },
    });

    return {
      draft: resp.text,
    };
  }
);
console.log('Loading r3_draft flow definition');