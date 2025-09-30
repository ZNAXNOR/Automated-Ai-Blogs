import { startFlowServer } from '@genkit-ai/express';


import {orchestrator} from './src/flows/orchestrator'

import {r0_trends} from './src/flows/r0_trends'
import {r1_ideate} from './src/flows/r1_ideate'
import {r2_outline} from './src/flows/r2_outline'
import {r3_draft} from './src/flows/r3_draft'
import {r4_polish} from './src/flows/r4_polish'
import {r5_meta} from './src/flows/r5_meta'
import {r6_coherence} from './src/flows/r6_coherence'
import {r7_publish} from './src/flows/r7_publish'

startFlowServer({
  flows: [orchestrator, r0_trends, r1_ideate, r2_outline, r3_draft, r4_polish, r5_meta, r6_coherence, r7_publish],
});