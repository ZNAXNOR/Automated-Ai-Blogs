import { ai } from '../clients/genkitInstance';

// --- Import all rounds ---
import { r0_trends } from './r0_trends.flow';
import { r1_ideate } from './r1_ideate.flow';
import { r2_outline } from './r2_outline.flow';
import { r3_draft } from './r3_draft.flow';
import { r4_polish } from './r4_polish.flow';
import { r5_meta } from './r5_meta.flow';
import { r6_coherence } from './r6_coherence.flow';
import { r7_publish } from './r7_publish.flow';

import { orchestrator_input, orchestrator_output } from '../schemas/orchestrator.schema';

console.log('[INIT] Loading orchestrator flow definition');

export const orchestrator = ai.defineFlow(
  {
    name: 'orchestrator',
    inputSchema: orchestrator_input,
    outputSchema: orchestrator_output,
  },
  async (input, flow) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[orchestrator] 🚀 Starting pipeline');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // -------------------- ROUND 0 --------------------
    console.log('[orchestrator][r0_trends] ▶ Starting');    
    const r0 = await r0_trends({ topic: input.topic ?? 'Data Analytics' });
    console.log('[orchestrator][r0_trends] ✅ Completed');
    console.log('  • Suggestions:', r0.suggestions?.length ?? 0);
    console.log('  • Base topic:', r0.baseTopic);

    const seedIdea = r0.suggestions?.[0]?.topic ?? r0.baseTopic;

    // -------------------- ROUND 1 --------------------
    console.log('\n[orchestrator][r1_ideate] ▶ Starting');
    const r1 = await r1_ideate({ seedPrompt: seedIdea });
    console.log('[orchestrator][r1_ideate] ✅ Completed');
    console.log('  • Ideas generated:', r1.ideas?.length ?? 0);

    // -------------------- ROUND 2 --------------------
    console.log('\n[orchestrator][r2_outline] ▶ Starting');
    const r2 = await r2_outline({ idea: r1.ideas });
    console.log('[orchestrator][r2_outline] ✅ Completed');
    console.log('  • Outline sections:', r2.outline?.sections?.length ?? 0);

    // -------------------- ROUND 3 --------------------
    console.log('\n[orchestrator][r3_draft] ▶ Starting');
    const r3 = await r3_draft({ outline: r2.outline });
    console.log('[orchestrator][r3_draft] ✅ Completed');
    console.log('  • Draft sections:', r3.draft?.length ?? 0);

    // -------------------- ROUND 4 --------------------
    console.log('\n[orchestrator][r4_polish] ▶ Starting');
    const r4 = await r4_polish({ draft: r3.draft });
    console.log('[orchestrator][r4_polish] ✅ Completed');
    console.log('  • Polished sections:', r4.polished?.length ?? 0);

    // -------------------- ROUND 5 --------------------
    console.log('\n[orchestrator][r5_meta] ▶ Starting');
    const r5 = await r5_meta({ polished: r4.polished });
    console.log('[orchestrator][r5_meta] ✅ Completed');
    console.log('  • Title:', r5.title);
    console.log('  • SEO Description length:', r5.seoDescription?.length ?? 0);
    console.log('  • Tags:', r5.tags?.length ?? 0);

    // -------------------- ROUND 6 --------------------
    console.log('\n[orchestrator][r6_coherence] ▶ Starting');
    const r6 = await r6_coherence({
      polished: r4.polished,
      title: r5.title,
      seoDescription: r5.seoDescription,
      tags: r5.tags,
    });
    console.log('[orchestrator][r6_coherence] ✅ Completed');
    console.log('  • Overall coherence score:', r6.overall);
    console.log('  • Duplicates detected:', r6.duplicates?.length ?? 0);

    // -------------------- ROUND 7 --------------------
    console.log('\n[orchestrator][r7_publish] ▶ Starting');
    const polishedHtml = r4.polished
      .map((s) => `<h2>${s.sectionId}</h2>\n<p>${s.content}</p>`)
      .join('\n');

    const wp = await r7_publish({
      title: r5.title,
      content: polishedHtml,
      status: 'draft',
    });
    console.log('[orchestrator][r7_publish] ✅ Completed');
    console.log('  • WP post ID:', wp.id ?? '(none)');
    console.log('  • Status:', wp.status ?? 'unknown');

    // -------------------- FINAL OUTPUT --------------------
    console.log('\n[orchestrator] 🏁 All rounds completed successfully.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const output = {
      title: r5.title,
      content: polishedHtml,
      meta: {
        seoDescription: r5.seoDescription,
        tags: r5.tags,
      },
      coherence: r6,
      wp,
    };

    return output;
  }
);
