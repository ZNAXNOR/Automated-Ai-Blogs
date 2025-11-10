
import {defineString, defineSecret} from "firebase-functions/params";

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


// ===============================
// Secrets
// ===============================
export const GEMINI_API_KEY_SECRET = defineSecret("GEMINI_API_KEY");
export const GCP_SERVICE_ACCOUNT_JSON_SECRET = defineSecret("GCP_SERVICE_ACCOUNT_JSON");
export const SERPAPI_KEY_SECRET = defineSecret("SERPAPI_KEY");
