/**
 * Shared utilities:
 *  - callApyhub: small wrapper for POST requests to APYHub endpoints
 *  - clamp, isKebabCase, wordCount helpers
 *
 * NOTE:
 *  - Uses global fetch. If running in a Node version without fetch,
 *    ensure a fetch polyfill is installed (node-fetch or node 18+).
 */
export async function callApyhub<T = unknown>(
  endpoint: string,
  payload: Record<string, unknown>,
  opts?: {
    apiKeyEnv?: string;
    timeoutMs?: number;
  }
): Promise<{success: boolean; data?: T; error?: unknown}> {
  const API_KEY = process.env.APYHUB_API_KEY || "";
  if (!API_KEY) {
    return {
      success: false,
      error: "[Evaluator] Missing APYHUB_API_KEY — using fallback",
    };
  }

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = opts?.timeoutMs ?? 8000;

  try {
    if (controller) setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });

    const text = await res.text();
    // best-effort json parse
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e) {
      json = {rawText: text};
    }

    if (!res.ok) {
      return {success: false, error: {status: res.status, body: json}};
    }
    return {success: true, data: json as T};
  } catch (err) {
    return {success: false, error: err};
  }
}

/**
 * Clamps a number to a given range.
 * @param {number} n The number to clamp.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @return {number} The clamped number.
 */
export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Checks if a string is in kebab-case.
 * @param {string} s The string to check.
 * @return {boolean} True if the string is in kebab-case, false otherwise.
 */
export function isKebabCase(s: string) {
  return typeof s === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

/**
 * Counts the words in a string.
 * @param {string} s The string to count the words in.
 * @return {number} The number of words in the string.
 */
export function wordCount(s: string) {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}
