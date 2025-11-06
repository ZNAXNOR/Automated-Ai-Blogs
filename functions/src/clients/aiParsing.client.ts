/**
 * Custom error class for AI parsing errors.
 */
class AIParseError extends Error {
  raw: string;
  /**
   * @param {string} message The error message.
   * @param {string} raw The raw string that failed to parse.
   */
  constructor(message: string, raw: string) {
    super(message);
    this.raw = raw;
  }
}

/**
 * Strips code fences from a string.
 * @param {string} text The text to strip.
 * @return {string} The stripped text.
 */
export function stripCodeFences(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/**
 * Extracts the first valid JSON object or array from a string.
 * @param {string} text The text to extract JSON from.
 * @return {Record<string, unknown> | null} The extracted JSON object or null.
 */
export function extractFirstJSON(text: string): Record<string, unknown> | null {
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  for (let end = text.length; end > start; end--) {
    const candidate = text.slice(start, end);
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch (e) {
      // keep trying
    }
  }
  return null;
}

/**
 * Safely parses JSON from an AI response.
 * @param {string} respText The AI response text.
 * @return {Record<string, unknown>} The parsed JSON object.
 * @throws {Error} If the response is empty.
 * @throws {AIParseError} If JSON parsing fails.
 */
export function safeParseJsonFromAI(respText: string): Record<string, unknown> {
  const raw = (respText ?? "").trim();
  if (!raw) throw new Error("Empty AI response");

  const cleaned = stripCodeFences(raw)
    .replace(/^output\s*:\s*/i, "")
    .replace(/^json\s*:\s*/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch (e) {
    const extracted = extractFirstJSON(cleaned);
    if (extracted !== null) return extracted;
    throw new AIParseError("Failed to parse JSON from AI response", raw);
  }
}
