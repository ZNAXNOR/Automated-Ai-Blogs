// import { ai } from "../clients/genkitInstance.client";

// // --- Import all rounds ---
// import { r0_trends } from "./r0_trends.flow";
// import { r1_ideate } from "./r1_ideate.flow";
// import { r2_angle } from "./r2_angle.flow";
// import { r3_draft } from "./r3_draft.flow";
// import { r4_meta } from "./r4_meta.flow";
// import { r5_polish } from "./r5_polish.flow";
// import { r6_coherence } from "./r6_coherence.flow";
// import { r7_publish } from "./r7_publish.flow";

// import { BLOG_TOPICS } from "../clients/blogTopic.client";

// import {
//   orchestrator_input,
//   orchestrator_output,
// } from "../schemas/flows/orchestrator.schema";

// console.log("[Orchestrator]   Loading orchestrator flow definition");


// export const orchestrator = ai.defineFlow(
//   {
//     name: "Orchestrator",
//     inputSchema: orchestrator_input,
//     outputSchema: orchestrator_output,
//   },
//   async (input, flow) => {
//     console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
//     console.log("[orchestrator] 🚀 Starting pipeline");
//     console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

//     // -------------------- ROUND 0 -------------------- //
//     console.log("[orchestrator][r0_trends] ▶ Starting");
    
//     const r0 = await r0_trends({ 
//       topic: Array.isArray(input.topic) && input.topic.length > 0
//             ? input.topic
//             : BLOG_TOPICS
//     });
//     if (!r0.suggestions || r0.suggestions.length === 0) {
//       throw new Error(
//         "[orchestrator] Aborting: r0_trends produced no suggestions."
//       );
//     }
    
//     console.log("[orchestrator][r0_trends] ✅ Completed");
//     console.log("  • Suggestions:", r0.suggestions?.length ?? 0);
//     console.log("  • Base topic:", r0.baseTopic);

//     const seedIdea = r0.suggestions?.[0]?.topic ?? r0.baseTopic;


//     // -------------------- ROUND 1 -------------------- //
//     console.log("\n[orchestrator][r1_ideate] ▶ Starting");

//     const r1 = await r1_ideate({ seedPrompt: seedIdea });
//     if (!r1 || !r1.title) {
//       throw new Error("[orchestrator] Aborting: r1_ideate produced no idea.");
//     }
    
//     console.log("[orchestrator][r1_ideate] ✅ Completed");
//     console.log("  • Idea generated: 1");


//     // -------------------- ROUND 2 -------------------- //
//     console.log("\n[orchestrator][r2_angle] ▶ Starting");
   
//     const r2 = await r2_angle({ idea: [r1] });
//     if (
//       !r2.outline ||
//       !r2.outline.sections ||
//       r2.outline.sections.length === 0
//     ) {
//       throw new Error(
//         "[orchestrator] Aborting: r2_angle produced no outline."
//       );
//     }
//     console.log("[orchestrator][r2_angle] ✅ Completed");
//     console.log("  • Outline sections:", r2.outline?.sections?.length ?? 0);


//     // -------------------- ROUND 3 -------------------- //
//     console.log("\n[orchestrator][r3_draft] ▶ Starting");
    
//     const r3 = await r3_draft({ outline: r2.outline });
//     if (!r3.draft || r3.draft.length === 0) {
//       throw new Error("[orchestrator] Aborting: r3_draft produced no draft.");
//     }
    
//     console.log("[orchestrator][r3_draft] ✅ Completed");
//     console.log("  • Draft sections:", r3.draft?.length ?? 0);


//     // -------------------- ROUND 4 -------------------- //
//     console.log("\n[orchestrator][r4_meta] ▶ Starting");
//     const draftTextForMeta = r3.draft.map(s => `<h2>${s.sectionId}</h2>\n<p>${s.content}</p>`).join('\n');
//     const r4 = await r4_meta({
//       blogTitle: r2.outline.title,
//       draftText: draftTextForMeta,
//       topic: r0.baseTopic,
//     });
//     if (!r4.title) {
//       throw new Error("[orchestrator] Aborting: r4_meta produced no title.");
//     }

//     console.log("[orchestrator][r4_meta] ✅ Completed");
//     console.log("  • Title:", r4.title);
//     console.log("  • SEO Description length:", r4.seoDescription?.length ?? 0);
//     console.log("  • Tags:", r4.tags?.length ?? 0);
    

//     // -------------------- ROUND 5 -------------------- //
//     console.log("\n[orchestrator][r5_polish] ▶ Starting");
    
//     const r5 = await r5_polish({ draft: r3.draft });
//     if (!r5.polished || r5.polished.length === 0) {
//       throw new Error(
//         "[orchestrator] Aborting: r5_polish produced no polished content."
//       );
//     }
    
//     console.log("[orchestrator][r5_polish] ✅ Completed");
//     console.log("  • Polished sections:", r5.polished?.length ?? 0);

    
//     // -------------------- ROUND 6 -------------------- //
//     console.log("\n[orchestrator][r6_coherence] ▶ Starting");
    
//     const r6 = await r6_coherence({
//       polished: r5.polished,
//       title: r4.title,
//       seoDescription: r4.seoDescription,
//       tags: r4.tags,
//     });
//     if (!r6.overall) {
//       throw new Error(
//         "[orchestrator] Aborting: r6_coherence produced no overall score."
//       );
//     }
    
//     console.log("[orchestrator][r6_coherence] ✅ Completed");
//     console.log("  • Overall coherence score:", r6.overall);
//     console.log("  • Duplicates detected:", r6.duplicates?.length ?? 0);


//     // -------------------- ROUND 7 -------------------- //
//     console.log("\n[orchestrator][r7_publish] ▶ Starting");
   
//     const polishedHtml = r5.polished
//       .map((s) => `<h2>${s.sectionId}</h2>\n<p>${s.content}</p>`)
//       .join("\n");

//     const wp = await r7_publish({
//       title: r4.title,
//       content: polishedHtml,
//       status: "draft",
//     });
//     if (!wp.id) {
//       throw new Error(
//         "[orchestrator] Aborting: r7_publish failed to return a post ID."
//       );
//     }
    
//     console.log("[orchestrator][r7_publish] ✅ Completed
// ]", wp.id ?? "(none)");
//     console.log("  • Status:", wp.status ?? "unknown");


//     // -------------------- FINAL OUTPUT -------------------- //
//     console.log("\n[orchestrator] 🏁 All rounds completed successfully.");
//     console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

//     const output = {
//       title: r4.title,
//       content: polishedHtml,
//       meta: {
//         seoDescription: r4.seoDescription,
//         tags: r4.tags,
//       },
//       coherence: r6,
//       wp,
//     };

//     return output;
//   }
// );
