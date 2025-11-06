import {GoogleGenAI} from "@google/genai";

export async function geminiSearch(seedTopic: string, opts?: { maxResults?: number }) {
  const maxResults = opts?.maxResults ?? 5;
  const ai = new GoogleGenAI({ /* optional client config*/ });


  const groundingTools = [
    {googleSearch: {}},
  ];


  const userInstruction = `
Search the web for authoritative articles, reports, or news about the following seed:
"${seedTopic}"

Return a JSON object with these fields:
{
  "seed": "<the seed you searched>",
  "results": [
    { "url": "<url>", "title": "<headline>", "snippet": "<one-line snippet (optional)>" }
  ]
}
Return at most ${maxResults} results. Only return JSON — no other text.
`;

  try {
    const config = {
      tools: groundingTools,
      // optional: increase reasoning or enable tool-related settings if SDK supports them
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

    const raw = (response as any)?.output?.[0]?.content?.[0]?.text ?? (response as any)?.text ?? JSON.stringify(response);
    if (!raw) return {seed: seedTopic, urls: [], headlines: [], raw};

    let parsed: any = null;
    try {
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      const candidate = firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw;
      parsed = JSON.parse(candidate);
    } catch (e) {
      return {seed: seedTopic, urls: [], headlines: [], raw, parseError: String(e)};
    }

    const results = Array.isArray(parsed?.results) ? parsed.results.slice(0, maxResults) : [];

    const urls = results.map((r: any) => r.url).filter(Boolean);
    const headlines = results.map((r: any) => r.title || r.snippet || "").filter(Boolean);

    return {
      seed: parsed?.seed ?? seedTopic,
      urls,
      headlines,
      raw,
      results,
    };
  } catch (err: any) {
    // bubble up safe info
    console.warn("[geminiSearchFallback] error", err?.message ?? err);
    return {seed: seedTopic, urls: [], headlines: [], error: String(err)};
  }
}
