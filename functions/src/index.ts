/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions/v2";
import {defineString} from "firebase-functions/params";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

export * from "./flows/index.js";


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
