/**
 * @file Aggregates all flow definitions for Firebase Cloud Functions deployment.
 */

import { orchestrator } from './orchestrator.flow.js';
import { r0_trends } from './R0_Trends/r0_trends.flow.js';
import { r1_ideate } from './R1_Ideate/r1_ideate.flow.js';
import { r2_angle } from './R2_Angle/r2_angle.flow.js';
import { r3_draft } from './R3_Draft/r3_draft.flow.js';
import { r4_meta } from './R4_Meta/r4_meta.flow.js';
import { r5_polish } from './R5_Polish/r5_polish.flow.js';
import { r8_publish } from './R8_Publish/r8_publish.flow.js';

export const flows = [
    orchestrator,
    r0_trends,
    r1_ideate,
    r2_angle,
    r3_draft,
    r4_meta,
    r5_polish,
    r8_publish
];

console.log('[Flows] All flow modules regstered.')
