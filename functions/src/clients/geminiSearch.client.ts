import {GoogleGenAI} from "@google/genai";

/**
 * Performs a Google search using the Gemini model.
 * @param {string} seedTopic The topic to search for.
 * @param {object} [opts] Options for the search.
 * @param {number} [opts.maxResults] The maximum number of results to return.
 * @return {Promise<object>} A promise that resolves to the search results.
 */
export async function geminiSearch(
  seedTopic: string,
  opts?: { maxResults?: number }
) {
  const maxResults = opts?.maxResults ?? 5;
  const ai = new GoogleGenAI({ /* optional client config*/ });


  const groundingTools = [
    {googleSearch: {}},
  ];


  const userInstruction = `
Search the web for authoritative articles, reports, or news \
  about the following seed: "${seedTopic}"

Return a JSON object with these fields:
{
  "seed": "<the seed you searched>",
  "results": [
    { "url": "<url>", "title": "<headline>", 
      "snippet": "<one-line snippet (optional)>" }
  ]
}
Return at most ${maxResults} results. Only return JSON — no other text.
`;

  try {
    const config = {
      tools: groundingTools,
      // optional: increase reasoning or enable tool-related settings
      // if SDK supports them
      // reasoning: true,
      // temperature: 0.0,
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{text: userInstruction}],
        },
      ],
      config,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (response as any)?.output?.[0]?.content?.[0]?.text ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response as any)?.text ?? JSON.stringify(response);
    if (!raw) return {seed: seedTopic, urls: [], headlines: [], raw};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any = null;
    try {
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      const candidate = firstBrace >= 0 && lastBrace > firstBrace ?
        raw.slice(firstBrace, lastBrace + 1) : raw;
      parsed = JSON.parse(candidate);
    } catch (e) {
      return {seed: seedTopic, urls: [], headlines: [], raw,
        parseError: String(e)};
    }

    const results = Array.isArray(parsed?.results) ?
      parsed.results.slice(0, maxResults) : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const urls = results.map((r: any) => r.url).filter(Boolean);
    const headlines = results.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.title || r.snippet || ""
    ).filter(Boolean);

    return {
      seed: parsed?.seed ?? seedTopic,
      urls,
      headlines,
      raw,
      results,
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // bubble up safe info
    console.warn("[geminiSearchFallback] error", err?.message ?? err);
    return {seed: seedTopic, urls: [], headlines: [], error: String(err)};
  }
}
