/**
 * @file Aggregates all flow definitions into a single array for registration with the Genkit runtime.
 * This file serves as a central registry for all the flows used in the application,
 * making it easy to manage and discover available workflows.
 */

import { orchestrator } from './orchestrator.flow';
import { r0_trends } from './R0_Trends/r0_trends.flow';
import { r1_ideate } from './R1_Ideate/r1_ideate.flow';
import { r2_angle } from './R2_Angle/r2_angle.flow';
import { r3_draft } from './R3_Draft/r3_draft.flow';
import { r4_meta } from './R4_Meta/r4_meta.flow';
import { r5_polish } from './R5_Polish/r5_polish.flow';
import { r8_publish } from './R8_Publish/r8_publish.flow';

// This array exports all the flows to be loaded by the Genkit framework.
export const flows = [
  orchestrator,
  r0_trends,
  r1_ideate,
  r2_angle,
  r3_draft,
  r4_meta,
  r5_polish,
  r8_publish,
];

// Log to confirm that all flow modules are imported and registered at startup.
console.log('[Flows] All flow modules registered');
