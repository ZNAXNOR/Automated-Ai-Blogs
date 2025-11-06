/**
 * Sanitizes topic strings for API use.
 * - Removes sentence-like, long, or descriptive topics.
 * - Splits multi-concept topics by common delimiters.
 * - Deduplicates and normalizes to lowercase.
 */
export function sanitizeTopics(
  topics: string[],
  maxChars = 100,
  maxWords = 25
): string[] {
  console.log(`[sanitizeTopics] Initial topics: ${topics.length}`);

  // 1. Initial strict filtering for sentence-like and long topics
  const filteredTopics = topics
    .map((t) => t.trim())
    .filter((t) => {
      const passes =
        t.length > 0 &&
        t.length <= maxChars &&
        t.split(/\s+/).length <= maxWords &&
        !/[.?!]/.test(t) && // Exclude topics with sentence punctuation
        !/\b(and|or|but|because)\b/i.test(t); // Exclude topics with common conjunctions
      return passes;
    });
  console.log(`[sanitizeTopics] After initial filtering: ${filteredTopics.length} topics`);

  // 2. Split multi-concept topics
  const DELIMITERS = /,|;|\||\/| - /;
  const splitTopics = filteredTopics.flatMap((topic) =>
    topic.split(DELIMITERS).map((p) => p.trim()).filter(Boolean)
  );
  console.log(`[sanitizeTopics] After splitting: ${splitTopics.length} topics`);

  // 3. Final length check and deduplication
  const finalTopics = splitTopics.filter((t) => t.length > 0 && t.length <= maxChars);

  // Deduplicate and lowercase
  const uniqueTopics = Array.from(new Set(finalTopics.map((t) => t.toLowerCase())));
  console.log(`[sanitizeTopics] Final unique topics: ${uniqueTopics.length}`);

  return uniqueTopics;
}
