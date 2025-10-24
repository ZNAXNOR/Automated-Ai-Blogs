// import {orchestrator} from './orchestrator.flow'
import {r0_trends} from './r0_trends.flow'
import {r1_ideate} from './r1_ideate.flow'
import {r2_angle} from './r2_angle.flow'
import {r3_draft} from './r3_draft.flow'
import {r4_meta} from './r4_meta.flow'
import {r5_polish} from './r5_polish.flow'
// import {r6_social} from './r6_social.flow'
// import {r7_evaluation} from './r7_evaluation.flow'
// import { r8_publish } from './r8_publish.flow'

export const flows = [
  // orchestrator,
  r0_trends,
  r1_ideate,
  r2_angle,
  r3_draft,
  r4_meta,
  r5_polish,
  // r6_social,
  // r7_evalustion,
  // r8_publish
];

console.log('[Flows]          All flow      modules registered');