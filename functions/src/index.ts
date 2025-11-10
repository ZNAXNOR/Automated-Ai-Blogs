import {onCallGenkit} from "firebase-functions/v2/https";
import {orchestrator} from "@src/flows/orchestrator.flow.js";
import {setGlobalOptions} from "firebase-functions/v2";
import {GEMINI_API_KEY_SECRET, GCP_SERVICE_ACCOUNT_JSON_SECRET, SERPAPI_KEY_SECRET} from "./config.js";

// Set global options BEFORE defining functions
setGlobalOptions({maxInstances: 10});

// Define a common options object for onCallGenkit
const onCallGenkitOptions = {
  // authPolicy: (auth: any) => !!auth?.token?.email_verified,
  secrets: [GEMINI_API_KEY_SECRET, GCP_SERVICE_ACCOUNT_JSON_SECRET, SERPAPI_KEY_SECRET],
  // enforceAppCheck: true,
  // consumeAppCheckToken: true,
  cors: ["https://blogwebsite-2004.web.app"],
};

// --- Wrap the Flow in onCallGenkit & Define an authorization policy ---
export const orchestratorFlow = onCallGenkit(onCallGenkitOptions, orchestrator);

console.log("[Flows] All flow modules regstered.");
