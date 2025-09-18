/**
 * Tiny HF text completion wrapper for pruning/boosting (optional).
 * Uses a very small model to keep tokens/cost minimal.
 * If HF token is missing, returns empty string.
 */

import { env } from "../utils/config";

const HF_ENDPOINT = "https://api-inference.huggingface.co/models/TheBloke/TinyLlama-1.1B-Chat-v1.0";

export async function hfTinyComplete(prompt: string): Promise<string> {
  if (!env.HF_TOKEN) return "";
  try {
    const res = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 128,
          temperature: 0.2,
          return_full_text: false,
        },
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    // HF text generation returns array or object depending on model
    const text =
      Array.isArray(data) && data[0]?.generated_text
        ? data[0].generated_text
        : data?.generated_text || data?.[0]?.summary_text || "";
    return typeof text === "string" ? text : "";
  } catch (e) {
    console.warn("HF call failed:", e);
    return "";
  }
}
