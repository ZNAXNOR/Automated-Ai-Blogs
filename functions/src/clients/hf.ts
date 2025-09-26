import { env } from "../utils/config";
import { HttpsError } from "firebase-functions/v2/https";
import { httpClient } from "./http";

const BASE_URL = "https://api-inference.huggingface.co/models/";

/**
 * Extracts generated or summary text from the Hugging Face API response.
 * @param {any} data The data from the Hugging Face API response.
 * @return {string} The extracted text, or an empty string if not found.
 */
function extractGeneratedText(data: any): string {
  if (data && (data.generated_text || data.summary_text)) {
    return data.generated_text || data.summary_text;
  }
  if (Array.isArray(data) && data.length > 0 && (data[0].generated_text || data[0].summary_text)) {
    return data[0].generated_text || data[0].summary_text;
  }
  return "";
}

export async function hfComplete(prompt: string, model: string): Promise<string> {
  if (!env.hfToken) {
    throw new HttpsError("unauthenticated", "HF_TOKEN is not set.");
  }
  try {
    const res = await httpClient.request({
      method: "POST",
      url: `${BASE_URL}${model}`,
      data: {
        inputs: prompt,
        parameters: {
          max_new_tokens: 512,
          return_full_text: false,
        },
      },
      headers: {
        "Authorization": `Bearer ${env.hfToken}`,
      },
      timeout: 120000,
    });

    const text = extractGeneratedText(res.data);

    if (typeof text !== "string" || text.length === 0) {
      console.error("Unexpected response format from Hugging Face API", res.data);
      throw new HttpsError("internal", "Unexpected response format from Hugging Face API");
    }
    return text;
  } catch (error: any) {
    if (error.response) {
      console.error("Hugging Face API Error:", error.response.data);
      throw new HttpsError("internal", `Hugging Face API returned status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error("Hugging Face API No Response:", error.request);
      throw new HttpsError("internal", "No response received from Hugging Face API");
    } else {
      console.error("Hugging Face API Setup Error:", error.message);
      throw new HttpsError("internal", "Error setting up request to Hugging Face API");
    }
  }
}

export function extractJsonFromText(text: string): string | null {
  const match = text.match(/\{.*\}/s);
  return match ? match[0] : null;
}
