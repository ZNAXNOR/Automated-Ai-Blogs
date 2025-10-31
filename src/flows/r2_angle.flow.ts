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

    // --- Use pipelineId for continuity (from r1) ---
    const { pipelineId } = input;
    if (!pipelineId) {
      throw new Error(
        'Missing pipelineId in flow input. r2 storage requires a persistent pipelineId to update Firestore and GCS.'
      );
    }

    // --- The input is now a single idea object, wrap in an array for consistent processing
    const topicIdea = [input];
    console.log('[r2_angle] Processing 1 idea for pipelineId:', pipelineId);

    const researchNotes: Array<{
      url: string;
      title?: string;
      summary?: string;
      contentType?: string;
      wordCount?: number;
    }> = [];

    // 🧾 Deterministic URL fetch with up to 3 retries
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

            // ✅ Directly call tool
            ctx = await urlContextTool({ url: rawUrl });

            if (ctx?.summary && ctx.summary.trim().length > 100) {
              break;
            } else {
              console.warn(`[r2_angle] Context too short on attempt ${attempt} for ${rawUrl}`);
            }
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
    if (researchNotes.length === 0)
      console.warn('No valid research notes found — proceeding without them.');


    // 🧠 Add grounded user context for prompt
    const formattedResearchText = researchNotes
      .map(
        (r, i) =>
          `(${i + 1}) ${r.title || 'Untitled'}
            URL: ${r.url}
            Summary: ${r.summary}
            Type: ${
            r.contentType || 'N/A'
          }
          Words: ${r.wordCount || 'N/A'}`
      )
      .join('');

    const userMessage = `
      These are verified factual research notes extracted directly from the URLs.
      Use them as your only factual grounding. Do not hallucinate or infer beyond them.

      ${formattedResearchText}
    `;

    const runAnglePrompt = ai.prompt('Round2_AnglePrompt');
    let resp;
    try {
      console.log('[r2_angle] Running grounded prompt...');
      resp = await runAnglePrompt({
        topicIdea,
        researchNotes,
        userInput: userMessage, // ✅ explicitly passed
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
      // Add pipelineId to the object before validation
      resultObj.pipelineId = pipelineId;
      // Validate against the declared output schema
      r2_angle_output.parse(resultObj);
      console.log('[r2_angle] ✅ Output validated successfully.');
    } catch (err) {
      console.error('[r2_angle] Schema validation failed', { raw, err });
      throw new Error('Output did not match r2_angle schema');
    }

    // 7️⃣ Inline subflow — Round2_Storage
    const storageResult = await ai.run('Round2_Storage', async () => {
      const args = { pipelineId: pipelineId, round: 'r2', data: resultObj, inputMeta: input };
      const { pipelineId: pId, round = 'r2', data } = args;
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

    // 8️⃣ Return enriched response
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
