/**
 * Normalizes a topic string by converting it to lowercase, trimming whitespace,
 * removing punctuation, and collapsing multiple spaces into a single space.
 * @param {string} str The input string to normalize.
 * @return {string} The normalized string.
 */
export function normalizeTopic(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // remove punctuation
    .replace(/\s+/g, " ");
}

export function normalizeTopicList(list: { topic: string; score: number }[]) {
  const seen = new Set<string>();
  const cleaned = [];

  for (const item of list) {
    const norm = normalizeTopic(item.topic);
    if (!seen.has(norm) && norm.length > 1) {
      seen.add(norm);
      cleaned.push({topic: norm, score: item.score});
    }
  }

  return cleaned;
}
