import { env } from "../utils/config";
import { HttpsError } from "firebase-functions/v2/https";
import { httpClient } from "./http";

const BASE_URL = "https://api-inference.huggingface.co/models/";

// Generic completion function
export async function hfComplete(prompt: string, model: string): Promise<string> {
  if (!env.hfToken) {
    throw new HttpsError("unauthenticated", "HF_TOKEN is not set.");
  }

  const endpoint = `${BASE_URL}${model}`;
  const payload = {
    inputs: prompt,
    parameters: { max_new_tokens: 512, return_full_text: false },
  };

  try {
    const res = await httpClient.request({
      method: "POST",
      url: endpoint,
      data: payload,
      headers: {
        "Authorization": `Bearer ${env.hfToken}`,
        "Content-Type": "application/json",
      },
      timeout: 120000, // 2 minutes
    });

    if (res.status !== 200) {
      throw new HttpsError("internal", `Hugging Face API returned status ${res.status}`);
    }

    const data = Array.isArray(res.data) ? res.data[0] : res.data;
    const text = data?.generated_text || data?.summary_text || "";

    if (typeof text !== "string") {
      throw new HttpsError("internal", "Unexpected response format from Hugging Face API");
    }

    return text;
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error calling Hugging Face API", { detail: error.message });
  }
}

// Specific-use function, now wrapping the generic one
export async function hfTinyComplete(prompt: string): Promise<string> {
  try {
    // Re-using the same tiny model as before for this specific utility.
    return await hfComplete(prompt, "TheBloke/TinyLlama-1.1B-Chat-v1.0");
  } catch (e: any) {
    if (e instanceof HttpsError && e.code === "unauthenticated") {
      return ""; // Non-fatal, just returns empty if not configured
    }
    // Re-throw other errors
    throw e;
  }
}

export function extractJsonFromText(text: string): string | null {
    const match = text.match(/\{.*\}/s);
    return match ? match[0] : null;
}
