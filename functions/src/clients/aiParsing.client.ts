class AIParseError extends Error {
    raw: string;
    constructor(message: string, raw: string) {
        super(message);
        this.raw = raw;
    }
}

export function stripCodeFences(text: string): string {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
  }
  
  export function extractFirstJSON(text: string): any | null {
    const start = text.search(/[\{\[]/);
    if (start === -1) return null;
    // Attempt to find a balanced JSON substring from that start
    for (let end = text.length; end > start; end--) {
      const candidate = text.slice(start, end);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        // keep trying
      }
    }
    return null;
  }
  
  export function safeParseJsonFromAI(respText: string): any {
    const raw = (respText ?? '').trim();
    if (!raw) throw new Error('Empty AI response');
  
    // 1) remove fences & labels quickly
    let cleaned = stripCodeFences(raw)
      .replace(/^output\s*:\s*/i, '')
      .replace(/^json\s*:\s*/i, '')
      .trim();
  
    // 2) try direct parse
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // 3) fallback: try to extract first balanced JSON object/array
      const extracted = extractFirstJSON(cleaned);
      if (extracted !== null) return extracted;
      // 4) failed -> throw with full raw for debugging
      throw new AIParseError('Failed to parse JSON from AI response', raw);
    }
  }
  