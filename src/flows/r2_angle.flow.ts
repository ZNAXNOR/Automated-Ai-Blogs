import { ai } from '../clients/genkitInstance.client';
import { r2_angle_input, r2_angle_output } from '../schemas/flows/r2_angle.schema';
import { safeParseJsonFromAI } from '../clients/aiParsing.client';
import { urlContextTool } from '../tools/urlContext.tool';
import { persistRoundOutput } from '../adapters/roundStorage.adapter';

console.log('[r2_angle]       Flow module loaded');

export const r2_angle = ai.defineFlow(
  {
    name: 'Round2_Angle',
    inputSchema: r2_angle_input,
    outputSchema: r2_angle_output,
  },
  async (input) => {
    console.log('[r2_angle] Flow invoked with input:', input);

    const { pipelineId } = input;
    if (!pipelineId) {
      throw new Error(
        'Missing pipelineId in flow input. r2 storage requires a persistent pipelineId.'
      );
    }

    const topicIdea = [input];
    console.log('[r2_angle] Processing 1 idea for pipelineId:', pipelineId);

    const researchNotes: Array<{
      url: string;
      title?: string;
      summary?: string;
      contentType?: string;
      wordCount?: number;
    }> = [];

    for (const idea of topicIdea) {
      if (!idea.references?.length) continue;

      for (const ref of idea.references) {
        const rawUrl = ref?.url;
        if (!rawUrl || typeof rawUrl !== 'string') continue;

        let attempt = 0;
        let ctx = null;

        while (attempt < 3) {
          attempt++;
          try {
            console.log(`[r2_angle] Fetching context (attempt ${attempt}) for:`, rawUrl);
            ctx = await urlContextTool({ url: rawUrl });
            if (ctx?.summary && ctx.summary.trim().length > 100) {
              break;
            }
            console.warn(`[r2_angle] Context too short on attempt ${attempt} for ${rawUrl}`);
          } catch (err) {
            console.warn(`[r2_angle] Attempt ${attempt} failed for ${rawUrl}:`, err);
          }
          if (attempt < 3) await new Promise((res) => setTimeout(res, 800 * attempt));
        }

        if (!ctx || !ctx.summary) {
          console.warn('[r2_angle] Skipping due to repeated failure:', rawUrl);
          continue;
        }

        const note = {
          url: ctx.url ?? rawUrl,
          title: ctx.title ?? ref.title ?? undefined,
          summary: ctx.summary.slice(0, 500),
          contentType: ctx.contentType ?? undefined,
          wordCount: ctx.wordCount ?? undefined,
        };

        researchNotes.push(note);
        console.log('[r2_angle] ✅ Added research note for:', rawUrl);
      }
    }

    console.log(`[r2_angle] Total research notes fetched: ${researchNotes.length}`);

    const runAnglePrompt = ai.prompt('Round2_AnglePrompt');
    let resp;
    try {
      console.log('[r2_angle] Running grounded prompt...');
      resp = await runAnglePrompt({
        topicIdea,
        researchNotes,
      });
    } catch (err) {
      console.error('[r2_angle] Angle synthesis prompt failed:', err);
      throw new Error('Angle synthesis prompt execution failed');
    }

    const raw = resp.text ?? (resp.output ? JSON.stringify(resp.output) : undefined);
    if (!raw) throw new Error('Angle synthesis returned no usable result');

    let resultObj: any;
    try {
      resultObj = safeParseJsonFromAI(raw);
      // Add pipelineId and researchNotes to the object before validation
      resultObj.pipelineId = pipelineId;
      resultObj.researchNotes = researchNotes;

      r2_angle_output.parse(resultObj);
      console.log('[r2_angle] ✅ Output validated successfully.');
    } catch (err) {
      console.error('[r2_angle] Schema validation failed', { raw, err });
      throw new Error('Output did not match r2_angle schema');
    }

    const storageResult = await ai.run('Round2_Storage', async () => {
      const args = { pipelineId: pipelineId, round: 'r2', data: resultObj, inputMeta: input };
      const { pipelineId: pId, round, data } = args;
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
        console.error(`[r2_angle:Round2_Storage] persistRoundOutput failed:`, err);
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

    const finalOutput = {
      ...resultObj,
      __storage: storageResult,
    };

    console.log('[r2_angle] ✅ Completed successfully:', {
      pipelineId: pipelineId,
      outlineSections: resultObj.outline?.sections?.length ?? 0,
      gcsPath: storageResult?.persistResult?.gcsPath,
    });

    return finalOutput;
  }
);
