import { ai } from "../clients/genkitInstance.client";
import { v4 as uuidv4 } from "uuid";

// --- Import all rounds ---
import { r0_trends } from "./r0_trends.flow";
import { r1_ideate } from "./r1_ideate.flow";
import { r2_angle } from "./r2_angle.flow";
import { r3_draft } from "./r3_draft.flow";
import { r4_meta } from "./r4_meta.flow";
import { r5_polish } from "./r5_polish.flow";
import { r8_publish } from "./r8_publish.flow";

import { BLOG_TOPICS } from "../clients/blogTopic.client";

import {
  orchestrator_input,
  orchestrator_output,
} from "../schemas/flows/orchestrator.schema";

console.log("[Orchestrator]   Loading orchestrator flow definition");

// Helper to generate a formatted pipeline ID
function generatePipelineId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const randomString = uuidv4().split('-')[0]; // Use a portion of the UUID for brevity
  return `${year}-${month}-${day}-${randomString}`;
}

export const orchestrator = ai.defineFlow(
  {
    name: "Orchestrator",
    inputSchema: orchestrator_input,
    outputSchema: orchestrator_output,
  },
  async (input, flow) => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[orchestrator] 🚀 Starting pipeline");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const pipelineId = generatePipelineId();
    console.log(`[orchestrator] Generated Pipeline ID: ${pipelineId}`);


    // -------------------- ROUND 0: Trends -------------------- //
    console.log("\n[orchestrator][r0_trends] ▶ Starting");
    const r0_input = {
      topic: Array.isArray(input.topic) && input.topic.length > 0
            ? input.topic
            : BLOG_TOPICS,
      pipelineId: pipelineId,
    };
    const r0 = await r0_trends(r0_input);
    if (!r0.suggestions || r0.suggestions.length === 0) {
      throw new Error(
        "[orchestrator] Aborting: r0_trends produced no suggestions."
      );
    }
    console.log("[orchestrator][r0_trends] ✅ Completed");
    console.log("  • Suggestions:", r0.suggestions?.length ?? 0);


    // -------------------- ROUND 1: Ideate -------------------- //
    console.log("\n[orchestrator][r1_ideate] ▶ Starting");
    const r1_input = { ...r0, pipelineId };
    const r1 = await r1_ideate(r1_input);
    if (!r1 || !r1.title) {
      throw new Error("[orchestrator] Aborting: r1_ideate produced no idea.");
    }
    console.log("[orchestrator][r1_ideate] ✅ Completed");
    console.log("  • Idea title:", r1.title);


    // -------------------- ROUND 2: Angle -------------------- //
    console.log("\n[orchestrator][r2_angle] ▶ Starting");
    const r2_input = { ...r1 }; // r1_output is the input for r2
    const r2 = await r2_angle(r2_input);
    if (
      !r2.outline ||
      !r2.outline.sections ||
      r2.outline.sections.length === 0
    ) {
      throw new Error(
        "[orchestrator] Aborting: r2_angle produced no outline."
      );
    }
    console.log("[orchestrator][r2_angle] ✅ Completed");
    console.log("  • Outline sections:", r2.outline?.sections?.length ?? 0);


    // -------------------- ROUND 3: Draft -------------------- //
    console.log("\n[orchestrator][r3_draft] ▶ Starting");
    const r3_input = { ...r2 }; // r2_output is the input for r3
    const r3 = await r3_draft(r3_input);
    if (!r3.fullDraft) {
      throw new Error("[orchestrator] Aborting: r3_draft produced no draft.");
    }
    console.log("[orchestrator][r3_draft] ✅ Completed");
    console.log("  • Draft length:", r3.fullDraft?.length ?? 0);


    // -------------------- ROUND 4: Meta -------------------- //
    console.log("\n[orchestrator][r4_meta] ▶ Starting");
    const r4_input = {
        ...r3,
        title: r3.title ?? r2.outline.title,
        topic: r1.seed,
        tone: input.tone,
    };
    const r4 = await r4_meta(r4_input);
    if (!r4.title) {
      throw new Error("[orchestrator] Aborting: r4_meta produced no metadata.");
    }
    console.log("[orchestrator][r4_meta] ✅ Completed");
    console.log("  • Title:", r4.title);
    console.log("  • SEO Description length:", r4.seoDescription?.length ?? 0);
    console.log("  • Tags:", r4.tags?.length ?? 0);


    // -------------------- ROUND 5: Polish -------------------- //
    console.log("\n[orchestrator][r5_polish] ▶ Starting");
    const r5_input = {
        pipelineId,
        draft: r3,
        meta: r4,
        tone: input.tone,
    };
    const r5 = await r5_polish(r5_input);
    if (!r5.polishedBlog) {
      throw new Error(
        "[orchestrator] Aborting: r5_polish produced no polished content."
      );
    }
    console.log("[orchestrator][r5_polish] ✅ Completed");
    console.log("  • Polished blog length:", r5.polishedBlog?.length ?? 0);

    
    // -------------------- ROUND 8: Publish -------------------- //
    console.log("\n[orchestrator][r8_publish] ▶ Starting");
    const r8_input = {
        pipelineId,
        polishedBlog: r5.polishedBlog,
        meta: r4,
        statusOverride: input.publishStatus,
    };
    const r8 = await r8_publish(r8_input);
    if (!r8.id && r8.status !== 'draft') {
      console.warn(
        `[orchestrator] r8_publish may have failed. Message: ${r8.message}`
      );
    }
    console.log("[orchestrator][r8_publish] ✅ Completed");
    console.log("  • Post ID:", r8.id ?? "(none)");
    console.log("  • Status:", r8.status ?? "unknown");


    // -------------------- FINAL OUTPUT -------------------- //
    console.log("\n[orchestrator] 🏁 All rounds completed successfully.");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const output = {
      pipelineId: pipelineId,
      title: r4.title,
      content: r5.polishedBlog,
      meta: r4,
      publishResult: r8,
    };

    return output;
  }
);