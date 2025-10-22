import {orchestrator} from './orchestrator.flow'
import {r0_trends} from './r0_trends.flow'
import {r1_ideate} from './r1_ideate.flow'
import {r2_angle} from './r2_angle.flow'
import {r3_draft} from './r3_draft.flow'
import {r4_polish} from './r4_polish.flow'
import {r5_meta} from './r5_meta.flow'
import {r6_coherence} from './r6_coherence.flow'
import {r7_publish} from './r7_publish.flow'

export const flows = [
  orchestrator,
  r0_trends,
  r1_ideate,
  r2_angle,
  r3_draft,
  r4_polish,
  r5_meta,
  r6_coherence,
  r7_publish,
];

console.log('[Flows]          All flow      modules registered');