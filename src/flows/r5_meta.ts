import { ai, model } from '../clients/genkitInstance';
import { r5_meta_input, r5_meta_output } from '../schemas/r5_meta.schema';
import { metaPrompt } from '../prompts/r5_meta.prompt';

export const r5_meta = ai.defineFlow(
  {
    name: 'r5_meta',
    inputSchema: r5_meta_input,
    outputSchema: r5_meta_output,
  },
  async (input) => {
    // Safely resolve topic/seed
    const polishedInput = input.polished

    // Replace placeholder in the prompt
    const promptText = metaPrompt.replace('{{POLISHED}}', polishedInput);

    const resp = await ai.generate({
      prompt: promptText,
      model,
      config: {
        temperature: 0.8,
      },
    });
    // Placeholder parsing: naive splitting
    const lines = resp.text.split('\n').filter(Boolean);
    // You’ll replace this with robust parse logic
    return {
      title: lines[0] ?? '',
      seoDescription: lines[1] ?? '',
      tags: lines.slice(2),
    };
  }
);
console.log('Loading r5_meta flow definition');