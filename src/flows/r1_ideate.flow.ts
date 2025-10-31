import { ai } from '../clients/genkitInstance.client';
import { r1_ideate_input, r1_ideate_output } from '../schemas/flows/r1_ideate.schema';
import { safeParseJsonFromAI } from '../clients/aiParsing.client';
import { persistRoundOutput } from '../adapters/roundStorage.adapter';
import { fetchNewsForTopics } from '../clients/google/googleNews.client';
import { googleSearchTool } from '../tools/googleSearch.tool';

console.log('[r1_ideate]      Flow module loaded');

// ---------- Helper: pick best topic list ----------
function pickTopicArray(input: any): string[] | null {
  if (input.results && input.results.length > 0) {
    const sorted = [...input.results].sort((a, b) => {
      const sum = (arr: any[]) => arr.reduce((s, x) => s + (x.score || 0), 0);
      return sum(b.suggestions || []) - sum(a.suggestions || []);
    });
    const chosen = sorted.find((r) => r.suggestions && r.suggestions.length > 0);
    if (chosen) return chosen.suggestions.map((s: any) => s.topic);
  }
  if (input.aggregatedTopics?.length) return input.aggregatedTopics;
  if (input.topic) return [input.topic];
  if (input.seedPrompt) return [input.seedPrompt];
  return null;
}

// ---------- Main flow ----------
export const r1_ideate = ai.defineFlow(
  {
    name: 'Round1_Ideation',
    inputSchema: r1_ideate_input,
    outputSchema: r1_ideate_output,
  },
  async (input) => {
    console.log('[r1_ideate] Flow invoked with input:', input);
    const parsedInput = r1_ideate_input.parse(input);

    const topicArray = pickTopicArray(parsedInput);
    if (!topicArray?.length) throw new Error('No usable topic array found in input.');

    const { pipelineId } = parsedInput;

    // 1️⃣ Fetch related news
    const headlines = await fetchNewsForTopics(topicArray);

    // 2️⃣ Decide whether to use search tool as fallback
    const useSearchTool = !headlines?.length || headlines.length < 3;
    if (useSearchTool) console.log('[r1_ideate] Using GoogleSearchTool fallback...');

    const newsSummary = headlines.length
      ? `Here are some recent headlines:\n${headlines.map((h) => `- ${h}`).join('\n')}`
      : 'No related live news found; rely purely on trend input.';

    // 3️⃣ Prompt call
    const promptFn = ai.prompt(
      useSearchTool ? 'Round1_IdeationPrompt_With_Search' : 'Round1_IdeationPrompt'
    );
    let resp;
    try {
      resp = await promptFn(
        {
          trendInput: topicArray.join(', '),
          recentNews: newsSummary,
        },
        { tools: useSearchTool ? [googleSearchTool] : [] }
      );
    } catch (err) {
      console.error('[r1_ideate] Prompt call failed:', err);
      throw new Error('Prompt execution error in r1_ideate');
    }

    // 4️⃣ Parse AI output
    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) throw new Error('Prompt returned no usable result');

    let ideationObj;
    try {
      ideationObj = safeParseJsonFromAI(raw);
    } catch (err) {
      console.error('[r1_ideate] JSON parse failed', { raw, err });
      throw new Error('Failed to parse prompt output');
    }

    // 5️⃣ Normalize + timestamp
    ideationObj.pipelineId = pipelineId;
    ideationObj.topic = topicArray[0];
    ideationObj.createdAt = new Date().toISOString();

    if (ideationObj.references?.length) {
      const seen = new Set();
      ideationObj.references = ideationObj.references.filter((r: any) => {
        if (!r?.url || seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
    }

    // 6️⃣ Validate schema
    r1_ideate_output.parse(ideationObj);

    // 7️⃣ Inline subflow — Round1_Storage
    const storageResult = await ai.run('Round1_Storage', async () => {
      const args = { pipelineId, round: 'r1', data: ideationObj, inputMeta: parsedInput };
      const { pipelineId: pId, round = 'r1', data } = args;
      const startedAt = new Date().toISOString();

      try {
        const persistResult = await persistRoundOutput(pId, round, data);
        return {
          ok: true,
          pipelineId: pId,
          round,
          persistResult,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.error(`[r1_ideate:Round1_Storage] persistRoundOutput failed:`, err);
        return {
          ok: false,
          pipelineId: pId,
          round,
          error: String(err),
          startedAt,
          finishedAt: new Date().toISOString(),
        };
      }
    });

    // 8️⃣ Return enriched response
    const finalOutput = {
      ...ideationObj,
      __storage: storageResult,
    };

    console.log('[r1_ideate] ✅ Completed successfully:', {
      pipelineId,
      ideas: ideationObj.ideas?.length ?? 0,
      gcsPath: storageResult?.persistResult?.gcsPath,
    });

    return finalOutput;
  }
);
