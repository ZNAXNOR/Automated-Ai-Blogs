/**
 * @file Aggregates all flow definitions for Firebase Cloud Functions
 * deployment. * This file wraps each flow in `onCallGenkit` and exports
 * them as individual functions.
 */

import {onCallGenkit} from "firebase-functions/v2/https";

import {defineSecret} from "firebase-functions/params";
const googleAIapiKey = defineSecret("GEMINI_API_KEY");

import {orchestrator} from "./orchestrator.flow.js";
import {r0Trends} from "./R0_Trends/r0_trends.flow.js";
import {r1Ideate} from "./R1_Ideate/r1_ideate.flow.js";
import {r2Angle} from "./R2_Angle/r2_angle.flow.js";
import {r3Draft} from "./R3_Draft/r3_draft.flow.js";
import {r4Meta} from "./R4_Meta/r4_meta.flow.js";
import {r5Polish} from "./R5_Polish/r5_polish.flow.js";
import {r8Publish} from "./R8_Publish/r8_publish.flow.js";

// Define a common options object for onCallGenkit
const onCallGenkitOptions = {
  authPolicy: (auth: any) => !!auth?.token?.email_verified,
  secrets: [googleAIapiKey],
  enforceAppCheck: true,
  consumeAppCheckToken: true,
};

// --- Wrap the Flow in onCallGenkit & Define an authorization policy ---
export const orchestratorFlow = onCallGenkit(onCallGenkitOptions, orchestrator);
export const r0TrendsFlow = onCallGenkit(onCallGenkitOptions, r0Trends);
export const r1IdeateFlow = onCallGenkit(onCallGenkitOptions, r1Ideate);
export const r2AngleFlow = onCallGenkit(onCallGenkitOptions, r2Angle);
export const r3DraftFlow = onCallGenkit(onCallGenkitOptions, r3Draft);
export const r4MetaFlow = onCallGenkit(onCallGenkitOptions, r4Meta);
export const r5PolishFlow = onCallGenkit(onCallGenkitOptions, r5Polish);
export const r8PublishFlow = onCallGenkit(onCallGenkitOptions, r8Publish);

console.log("[Flows] All flow modules regstered.");
