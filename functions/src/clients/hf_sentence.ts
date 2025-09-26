import { env } from "../utils/config";
import { HttpsError } from "firebase-functions/v2/https";
import { httpClient } from "./http";

const BASE_URL = "https://api-inference.huggingface.co/models/";

/**
 * Calculates sentence similarity scores using the Hugging Face Inference API.
 * @param source The source sentence to compare against.
 * @param sentences An array of sentences to compare with the source.
 * @returns A promise that resolves to an array of similarity scores (numbers).
 */
export async function calculateSimilarity(
  source: string,
  sentences: string[]
): Promise<number[]> {
  if (!env.hfToken) {
    throw new HttpsError("unauthenticated", "HF_TOKEN is not set.");
  }

  try {
    const res = await httpClient.request({
      method: "POST",
      url: `${BASE_URL}${env.hfModelR6}`,
      data: {
        inputs: {
          source_sentence: source,
          sentences: sentences,
        },
      },
      headers: {
        "Authorization": `Bearer ${env.hfToken}`,
      },
      timeout: 30000, // 30 seconds
    });

    const scores = res.data;

    if (!Array.isArray(scores) || scores.some((s) => typeof s !== "number")) {
      console.error("Unexpected response format from Hugging Face API", scores);
      throw new HttpsError("internal", "Unexpected response format from Hugging Face API");
    }

    return scores;
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
