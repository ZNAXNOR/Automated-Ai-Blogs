/**
 * @file Manages the end-to-end blog generation pipeline by orchestrating a series of modular flows (rounds).
 * @author Omkar Dalvi
 *
 * This flow is the main entry point for generating a complete blog post. It sequences through
 * each stage of the content creation process, from initial trend analysis to final publication,
 * passing the output of each step as the input to the next.
 *
 * The pipeline is designed for robustness and observability, with detailed logging at each
 * step and a unique `pipelineId` to trace the entire lifecycle of a single run.
 */

import { ai } from '@clients/genkitInstance.client.js';
import { v4 as uuidv4 } from 'uuid';

// --- Import all processing rounds ---
import { r0_trends } from '@src/flows/R0_Trends/r0_trends.flow.js';
import { r1_ideate } from '@src/flows/R1_Ideate/r1_ideate.flow.js';
import { r2_angle } from '@src/flows/R2_Angle/r2_angle.flow.js';
import { r3_draft } from '@src/flows/R3_Draft/r3_draft.flow.js';
import { r4_meta } from '@src/flows/R4_Meta/r4_meta.flow.js';
import { r5_polish } from '@src/flows/R5_Polish/r5_polish.flow.js';
import { r8_publish } from '@src/flows/R8_Publish/r8_publish.flow.js';

import { BLOG_TOPICS } from '@clients/blogTopic.client.js';
import {
  orchestrator_input,
  orchestrator_output,
} from '@src/schemas/flows/orchestrator.schema.js';

console.log('[Orchestrator] Loading orchestrator flow definition');

/**
 * Generates a unique, date-prefixed ID for tracking a single pipeline execution.
 * @returns A formatted string, e.g., "2023-10-27-a4e9c1f0".
 */
function generatePipelineId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const randomString = uuidv4().split('-')[0]; // Brief and unique
  return `${year}-${month}-${day}-${randomString}`;
}

export const orchestrator = ai.defineFlow(
  {
    name: 'Orchestrator',
    inputSchema: orchestrator_input,
    outputSchema: orchestrator_output,
  },
  async (input, flow) => {
    const pipelineId = generatePipelineId();
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 Starting Pipeline ID: ${pipelineId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // -------------------- ROUND 0: Trends Analysis -------------------- //
    try {
      console.log('\n▶️ [R0] Starting Trend Analysis...');
      const r0_input = {
        topic: Array.isArray(input.topic) && input.topic.length > 0
          ? input.topic
          : BLOG_TOPICS,
        pipelineId,
      };
      const r0 = await r0_trends(r0_input);
      if (!r0.suggestions || r0.suggestions.length === 0) {
        throw new Error('[Orchestrator] Aborting: R0 failed to produce any topic suggestions.');
      }
      console.log(`✅ [R0] Completed: Found ${r0.suggestions.length} suggestions.`);

      // -------------------- ROUND 1: Ideation -------------------- //
      console.log('\n▶️ [R1] Starting Ideation...');
      const r1 = await r1_ideate({ ...r0, pipelineId });
      if (!r1 || !r1.title) {
        throw new Error('[Orchestrator] Aborting: R1 failed to generate a blog idea.');
      }
      console.log(`✅ [R1] Completed: Generated idea "${r1.title}".`);

      // -------------------- ROUND 2: Angle & Outline -------------------- //
      console.log('\n▶️ [R2] Developing Angle and Outline...');
      const r2 = await r2_angle(r1); // R1 output is the direct input for R2
      if (!r2.outline || !r2.outline.sections || r2.outline.sections.length === 0) {
        throw new Error('[Orchestrator] Aborting: R2 failed to produce a structured outline.');
      }
      console.log(`✅ [R2] Completed: Created outline with ${r2.outline.sections.length} sections.`);

      // -------------------- ROUND 3: Drafting -------------------- //
      console.log('\n▶️ [R3] Generating Draft Content...');
      const r3 = await r3_draft(r2); // R2 output is the direct input for R3
      if (!r3.fullDraft) {
        throw new Error('[Orchestrator] Aborting: R3 failed to produce a draft.');
      }
      console.log(`✅ [R3] Completed: Draft length is ${r3.fullDraft.length} characters.`);

      // -------------------- ROUND 4: Metadata Generation -------------------- //
      console.log('\n▶️ [R4] Creating Metadata (SEO, Tags)...');
      const r4_input = {
        ...r3,
        title: r3.title ?? r2.outline.title,
        topic: r1.seed,
        tone: input.tone,
      };
      const r4 = await r4_meta(r4_input);
      if (!r4.title) {
        throw new Error('[Orchestrator] Aborting: R4 failed to produce metadata.');
      }
      console.log(`✅ [R4] Completed: Generated metadata for "${r4.title}".`);

      // -------------------- ROUND 5: Polishing -------------------- //
      console.log('\n▶️ [R5] Polishing Final Content...');
      const r5_input = {
        pipelineId,
        draft: r3,
        meta: r4,
        tone: input.tone,
      };
      const r5 = await r5_polish(r5_input);
      if (!r5.polishedBlog) {
        throw new Error('[Orchestrator] Aborting: R5 failed to produce polished content.');
      }
      console.log(`✅ [R5] Completed: Polished blog length is ${r5.polishedBlog.length} characters.`);

      // -------------------- ROUND 8: Publishing -------------------- //
      console.log('\n▶️ [R8] Publishing to WordPress...');
      const r8_input = {
        pipelineId,
        polishedBlog: r5.polishedBlog,
        meta: r4,
        statusOverride: input.publishStatus,
      };
      const r8 = await r8_publish(r8_input);
      if (!r8.id && r8.status !== 'draft') {
        console.warn(`⚠️ [R8] Publishing may have failed. Message: ${r8.message}`);
      }
      console.log(`✅ [R8] Completed: Post ID ${r8.id ?? '(none)'}, Status: ${r8.status ?? 'unknown'}.`);

      // -------------------- FINAL OUTPUT -------------------- //
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🏁 Pipeline Finished Successfully!
  🔗 Post Link: ${r8.link ?? 'N/A'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      const output = {
        pipelineId,
        title: r4.title,
        content: r5.polishedBlog,
        meta: r4,
        publishResult: r8,
      };

      return output;
    } catch (error) {
      console.error('[Orchestrator] Pipeline failed:', error);
      throw error;
    }
  }
);
