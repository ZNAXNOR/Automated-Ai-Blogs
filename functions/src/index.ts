/**
 * @file Aggregates all flow definitions for Firebase Cloud Functions
 * deployment. * This file wraps each flow in `onCallGenkit` and exports
 * them as individual functions.
 */

import {onCallGenkit} from "firebase-functions/v2/https";

import {defineSecret} from "firebase-functions/params";
const googleAIapiKey = defineSecret("GEMINI_API_KEY");
const gcpServiceAccountJsonSecret = defineSecret("GCP_SERVICE_ACCOUNT_JSON");
const serpApiKey = defineSecret("SERPAPI_KEY");

import {orchestrator} from "./flows/orchestrator.flow.js";
import {r0Trends} from "./flows/R0_Trends/r0_trends.flow.js";
import {r1Ideate} from "./flows/R1_Ideate/r1_ideate.flow.js";
import {r2Angle} from "./flows/R2_Angle/r2_angle.flow.js";
import {r3Draft} from "./flows/R3_Draft/r3_draft.flow.js";
import {r4Meta} from "./flows/R4_Meta/r4_meta.flow.js";
import {r5Polish} from "./flows/R5_Polish/r5_polish.flow.js";
import {r8Publish} from "./flows/R8_Publish/r8_publish.flow.js";
import {setGlobalOptions} from "firebase-functions/v2";
import {defineString} from "firebase-functions/params";

// Define a common options object for onCallGenkit
const onCallGenkitOptions = {
  // authPolicy: (auth: any) => !!auth?.token?.email_verified,
  secrets: [googleAIapiKey, gcpServiceAccountJsonSecret, serpApiKey],
  // enforceAppCheck: true,
  // consumeAppCheckToken: true,
  cors: ["https://blogwebsite-2004.web.app"],
};

// --- Wrap the Flow in onCallGenkit & Define an authorization policy ---
export const orchestratorFlow = onCallGenkit(
  onCallGenkitOptions, orchestrator
);

console.log("[Flows] All flow modules regstered.");

setGlobalOptions({maxInstances: 10});

// ===============================
// Parameterized Configuration
// ===============================

// --- Google Custom Search Engine Api ---
export const GOOGLE_CSE_API_KEY_CONFIG = defineString("GOOGLE_CSE_API_KEY", {
  description: "Google CSE API Key. Get one if not available at https://developers.google.com/custom-search/v1/introduction#identify_your_application_to_google_with_api_key",
});
export const GOOGLE_CSE_CX_CONFIG = defineString("GOOGLE_CSE_CX", {
  description: "Google CSE CX code.",
});

// --- WordPress website credentials ---
export const WP_API_URL_CONFIG = defineString("WP_API_URL", {
  description: "WordPress API base URL"
});
export const WP_PASSWORD_CONFIG = defineString("WP_PASSWORD", {
  description: "WordPress appication Password. Generate at https://[WP_API_URL]/wp-admin/profile.php#ApplicationPasswords"
});
export const WP_USERNAME_CONFIG = defineString("WP_USERNAME", {
  description: "WordPress username"
});

// --- GCP & Firebase Configurations ---
export const GCP_PROJECT_ID_CONFIG = defineString("GCP_PROJECT_ID", {
  description: "Google Cloud Platform / Firebase project ID"
});
export const GCS_BUCKET_NAME_CONFIG = defineString("GCS_BUCKET_NAME", {
  description: "Google Cloud Storage Bucket name"
});

// --- News API Keys ---
export const NEWSDATA_API_CONFIG = defineString("NEWSDATA_API", {
  description: "NewsData API Key. Get one if not available at https://newsdata.io/"
});
export const GNEWS_API_CONFIG = defineString("GNEWS_API", {
  description: "GNews API Key. Get one if not available at https://gnews.io/"
});
