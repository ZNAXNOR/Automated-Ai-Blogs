import { ai } from '../clients/genkitInstance';

// Import flows
import { r0_trends } from './r0_trends';
import { r1_ideate } from './r1_ideate';
import { r2_outline } from './r2_outline';
import { r3_draft } from './r3_draft';
import { r4_polish } from './r4_polish';
import { r5_meta } from './r5_meta';
import { r6_coherence } from './r6_coherence';
import { r7_publish } from './r7_publish';

import { orchestrator_input, orchestrator_output } from '../schemas/orchestrator.schema';

// Define orchestrator flow
export const orchestrator = ai.defineFlow(
  {
    name: 'orchestrator',
    inputSchema: orchestrator_input,
    outputSchema: orchestrator_output,
  },
  async () => {
    // Round 0
    const r0 = await r0_trends({ topic: 'Data Analytics' }); // default seed inside flow
    const seedIdea = r0.suggestions[0]?.topic ?? r0.baseTopic;

    // Round 1
    const r1 = await r1_ideate({ seedPrompt: seedIdea });

    // Round 2
    const r2 = await r2_outline({ idea: r1.ideas });

    // Round 3
    const r3 = await r3_draft({ outline: r2.outline });

    // Round 4
    const r4 = await r4_polish({ draft: r3.draft });

    // Round 5
    const r5 = await r5_meta({ polished: r4.polished });

    // Round 6
    const r6 = await r6_coherence({
      polished: r4.polished,
      title: r5.title,
      seoDescription: r5.seoDescription,
      tags: r5.tags,
    });

    // Round 7 (always draft mode for safety)
    const wp = await r7_publish({
      title: r5.title,
      content: r4.polished,
      status: 'draft',
    });

    return {
      title: r5.title,
      content: r4.polished,
      meta: {
        seoDescription: r5.seoDescription,
        tags: r5.tags,
      },
      wp,
    };
  }
);

console.log('Loading orchestrator flow definition');
