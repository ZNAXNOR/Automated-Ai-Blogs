import { ai, model } from '../clients/genkitInstance';
import { r6_coherence_input, r6_coherence_output } from '../schemas/r6_coherence.schema';
import { coherencePrompt } from '../prompts/r6_coherence.prompt';

export const r6_coherence = ai.defineFlow(
  {
    name: 'r6_coherence',
    inputSchema: r6_coherence_input,
    outputSchema: r6_coherence_output,
  },
  async (input) => {
    // Safely resolve topic/seed
    const polishedInput = input.polished
    const titleInput = input.title
    const seoDescriptionInput = input.seoDescription
    const tagsInput = input.tags

    // Replace placeholder in the prompt
    const promptText = coherencePrompt.replace('{{POLISHED}}', polishedInput)
                                      .replace('{{TITLE}}', titleInput)
                                      .replace('{{SEO_DESCRIPTION}}', seoDescriptionInput)
                                      .replace('{{TAGS}}', tagsInput.join(', '));
  
    const resp = await ai.generate({
      prompt: promptText,
      model,
      config: {
        temperature: 0.6,
      },
    });
    return {
      finalContent: resp.text,
    };
  }
);
console.log('Loading r6_coherence flow definition');