import { env } from "../utils/config";
import { HttpsError } from "firebase-functions/v2/https";
import { httpClient } from "./http";

const HF_API_URL = `https://api-inference.huggingface.co/models/${env.hfModelR6}`;

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
    throw new HttpsError("unauthenticated", "HUGGING_FACE_TOKEN is not set.");
  }

  const payload = {
    inputs: {
      source_sentence: source,
      sentences: sentences,
    },
  };

  try {
    const res = await httpClient.request({
      method: "POST",
      url: HF_API_URL,
      data: payload,
      headers: {
        Authorization: `Bearer ${env.hfToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 seconds
    });

    if (res.status !== 200) {
      throw new HttpsError("internal", `Hugging Face API returned status ${res.status}`);
    }

    const scores = res.data as number[] | null;

    if (!Array.isArray(scores) || scores.some(s => typeof s !== 'number')) {
      throw new HttpsError("internal", "Invalid response format from Hugging Face API");
    }

    return scores;

  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error calling Hugging Face API", { detail: error.message });
  }
}
