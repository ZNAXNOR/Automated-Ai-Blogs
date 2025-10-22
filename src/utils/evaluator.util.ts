/**
 * Shared utilities:
 *  - callApyhub: small wrapper for POST requests to APYHub endpoints
 *  - clamp, isKebabCase, wordCount helpers
 *
 * NOTE:
 *  - Uses global fetch. If running in a Node version without fetch,
 *    ensure a fetch polyfill is installed (node-fetch or node 18+).
 */

export async function callApyhub<T = any>(
  endpoint: string,
  payload: Record<string, any>,
  opts?: { 
    apiKeyEnv?: string; timeoutMs?: number
  }
): Promise<{ 
  success: boolean; data?: T; error?: any 
}> {
  const API_KEY = process.env.APYHUB_API_KEY || "";
  if (!API_KEY) {
    return { 
      success: false, error: `[Evaluator] Missing APYHUB_API_KEY — using fallback`      
    };
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = opts?.timeoutMs ?? 8000;

  try {
    if (controller) setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });

    const text = await res.text();
    // best-effort json parse
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e) {
      json = { rawText: text };
    }

    if (!res.ok) {
      return { success: false, error: { status: res.status, body: json } };
    }
    return { success: true, data: json as T };
  } catch (err) {
    return { success: false, error: err };
  }
}

/** clamp n into [min,max] */
export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/** basic kebab-case check */
export function isKebabCase(s: string) {
  return typeof s === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

/** rough word count */
export function wordCount(s: string) {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}
