/**
 * @file Generates the full draft of the blog post, section by section.
 * @author Omkar Dalvi
 *
 * This flow (Round 3) transforms a structured outline into a complete first draft.
 * It operates in two main phases:
 * 1. **Concurrent Section Drafting**: It iterates through each section of the outline and runs a
 *    dedicated AI prompt (`draftSectionPrompt`) to generate the content for that specific section.
 *    This allows for focused and detailed content generation.
 * 2. **Final Draft Assembly**: Once all sections are drafted, it runs a final AI prompt
 *    (`draftPrompt`) to stitch the sections together into a cohesive narrative. This prompt
 *    also generates a subtitle, reading time, and a full-text version of the draft.
 * 3. **Error Handling**: If a section fails to generate, it is gracefully handled, and if the final
 *    assembly fails, a fallback mechanism concatenates the generated sections.
 * 4. **Persistence**: The final draft object is persisted to a storage bucket.
 */

import { ai } from '../../clients/genkitInstance.client.js';
import {
  r3_draft_input,
  r3_draft_output,
  R3SectionInput,
  R3SectionOutput,
} from '../../schemas/flows/r3_draft.schema.js';
import { draftPrompt } from '../../prompts/flows/r3_draft.prompt.js';
import { draftSectionPrompt } from '../../prompts/flows/r3_draft_section.prompt.js';
import { safeParseJsonFromAI } from '../../clients/aiParsing.client.js';
import { round3StorageStep } from './r3_storage.step.js';

console.log('[r3_draft] Flow module loaded');

/**
 * The main flow for Round 3, responsible for generating the first full draft of the blog post.
 */
export const r3_draft = ai.defineFlow(
  {
    name: 'Round3_Draft',
    inputSchema: r3_draft_input,
    outputSchema: r3_draft_output,
  },
  async (input) => {
    console.log(`[r3_draft] Starting draft generation for pipeline: ${input.pipelineId}`);
    const { pipelineId, outline, researchNotes } = input as any;

    if (!outline.sections || outline.sections.length === 0) {
      console.warn('[r3_draft] No sections in outline. Returning a minimal draft.');
      // Return a valid, minimal output if there's nothing to draft.
      return {
        pipelineId,
        title: outline.title ?? 'Untitled',
        fullDraft: '',
        sections: [],
      };
    }

    // 1. Generate Content for Each Section Concurrently
    // This approach speeds up the drafting process by running AI prompts in parallel.
    const sectionPromises = outline.sections.map(async (section: any) => {
      const sectionInput: R3SectionInput = {
        title: outline.title,
        researchNotes,
        sectionId: section.id,
        heading: section.heading,
        bullets: section.bullets ?? [],
        estWords: section.estWords ?? 200,
      };

      try {
        console.log(`[r3_draft] Generating content for section: "${section.heading}"`);
        const response = await draftSectionPrompt(sectionInput);
        const rawOutput = response.text ?? JSON.stringify(response.output);
        return safeParseJsonFromAI(rawOutput) as R3SectionOutput;
      } catch (error) {
        console.error(`[r3_draft] Failed to generate section "${section.heading}":`, error);
        // Return a fallback structure on error to prevent breaking the entire flow.
        return { 
          sectionId: section.id,
          heading: section.heading,
          content: '[Content generation failed for this section]',
        };
      }
    });

    const generatedSections = await Promise.all(sectionPromises);
    console.log(`[r3_draft] Successfully generated content for ${generatedSections.length} sections.`);

    // 2. Assemble the Final Draft
    // A final AI prompt is used to stitch the sections into a cohesive narrative.
    let finalDraft;
    try {
      console.log('[r3_draft] Assembling final draft from all sections...');
      const assemblyResponse = await draftPrompt({
        title: outline.title,
        sections: generatedSections,
        outline,
        researchNotes,
      });

      const rawOutput = assemblyResponse.text ?? JSON.stringify(assemblyResponse.output);
      finalDraft = safeParseJsonFromAI(rawOutput);
    } catch (error) {
      console.error('[r3_draft] Final draft assembly failed. Creating fallback draft.', error);
      // Fallback: manually construct the draft if the assembly prompt fails.
      const fallbackContent = generatedSections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
      finalDraft = {
        title: outline.title,
        fullDraft: fallbackContent,
        sections: generatedSections,
      };
    }

    // Validate the final output against the schema.
    const output = r3_draft_output.parse({ ...finalDraft, pipelineId });
    console.log(`[r3_draft] Draft generation complete. Total length: ${output.fullDraft.length} characters.`);

    // 3. Persist the output for the next round.
    const storageResult = await round3StorageStep(pipelineId, output);

    return { ...output, __storage: storageResult };
  }
);
