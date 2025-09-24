import { env } from "../utils/config";
import { HttpsError } from "firebase-functions/v2/https";
import { httpClient } from "./http";

const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.geminiKey}`;

export async function geminiComplete(prompt: string): Promise<string> {
  if (!env.geminiKey) {
    throw new HttpsError("unauthenticated", "GEMINI_KEY is not set.");
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  try {
    const res = await httpClient.request({
      method: "POST",
      url: GEMINI_BASE_URL,
      data: payload,
      headers: { "Content-Type": "application/json" },
      timeout: 120000, // 2 minutes
    });

    if (res.status !== 200) {
      throw new HttpsError("internal", `Gemini API returned status ${res.status}`);
    }

    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (typeof text !== "string" || !text) {
        throw new HttpsError("internal", "Unexpected or empty response format from Gemini API");
    }

    return text;
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error calling Gemini API", { detail: error.message });
  }
}

export function extractJsonFromText(text: string): string | null {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    return match ? match[1] : null;
}
