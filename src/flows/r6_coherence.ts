import { ai, model } from '../clients/genkitInstance';
import { r6_coherence_input, r6_coherence_output } from '../schemas/r6_coherence.schema';
import { coherencePrompt } from '../prompts/r6_coherence.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing';

console.log('[INIT] Loading r6_coherence flow definition');

export const r6_coherence = ai.defineFlow(
  {
    name: 'r6_coherence',
    inputSchema: r6_coherence_input,
    outputSchema: r6_coherence_output,
  },
  async (input, flow) => {
    // ---- Normalize inputs ----
    const polishedInput = input.polished ?? [];
    const titleInput = input.title?.trim() ?? '';
    const seoDescriptionInput = input.seoDescription?.trim() ?? '';
    const tagsInput = Array.isArray(input.tags) ? input.tags : [];

    // ---- Serialize for prompt ----
    const polishedJson = JSON.stringify(polishedInput, null, 2);
    const tagsString = JSON.stringify(tagsInput);

    // ---- Build prompt ----
    const promptText = coherencePrompt
      .replace('{{POLISHED}}', polishedJson)
      .replace('{{TITLE}}', titleInput)
      .replace('{{SEO_DESCRIPTION}}', seoDescriptionInput)
      .replace('{{TAGS}}', tagsString);

    // ---- Logging before generation ----
    console.log('[r6_coherence] --- Prompt Summary ---');
    console.log('  • Sections:', polishedInput.length);
    console.log('  • Title:', titleInput);
    console.log('  • SEO Description length:', seoDescriptionInput.length);
    console.log('  • Tags count:', tagsInput.length);
    console.log('  • Prompt size (chars):', promptText.length);

    // ---- Model call ----
    console.log('[r6_coherence] Generating response with model:', model);
    const resp = await ai.generate({
      prompt: promptText,
      model,
      config: {
        temperature: 0.1, // keep near-zero for factual/metric-based evaluation
      },
    });

    // ---- Log partial output for debugging ----
    console.log('[r6_coherence] Raw model output (first 300 chars):');
    console.log(resp.text.slice(0, 300));

    // ---- Parse + validate ----
    let coherenceObj;
    try {
      coherenceObj = safeParseJsonFromAI(resp.text);
    } catch (err) {
      console.error('[r6_coherence] ❌ JSON parse error', { raw: resp.text });
      throw err;
    }

    try {
      r6_coherence_output.parse(coherenceObj);
    } catch (validationErr) {
      console.error('[r6_coherence] ❌ Schema validation failed:', validationErr);
      throw validationErr;
    }

    // ---- Logging final metrics ----
    console.log('[r6_coherence] ✅ Coherence flow completed.');
    console.log('  • Overall Score:', coherenceObj.overall);
    console.log('  • Duplicates found:', coherenceObj.duplicates.length);
    console.log('  • Notes count:', coherenceObj.notes.length);

    return coherenceObj;
  }
);
