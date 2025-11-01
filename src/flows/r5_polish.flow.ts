import { ai } from "@src/clients/genkitInstance.client";
import { polishPrompt } from "@src/prompts/flows/r5_polish.prompt";
import { r5_polish_input, r5_polish_output } from "@src/schemas/flows/r5_polish.schema";
import { safeParseJsonFromAI } from "@src/clients/aiParsing.client";
import { z } from "zod";
import { persistRoundOutput } from '../adapters/roundStorage.adapter';

console.log("[r5_polish]      Flow module loaded");

export const r5_polish = ai.defineFlow(
  {
    name: "Round5_Polish",
    inputSchema: r5_polish_input,
    outputSchema: r5_polish_output,
  },
  async (input) => {
    const { pipelineId, draft, meta, tone } = input;
    const blogTitle = meta?.title ?? draft?.title ?? "Untitled Blog";
    const topic = meta?.primaryCategory ?? blogTitle;
    console.log(`[r5_polish] Flow invoked for: "${blogTitle}"`);

    let parsed: z.infer<typeof r5_polish_output> | null = null;
    let attempt = 0;
    const maxRetries = 2;

    const draftText =
      draft?.fullDraft ??
      draft?.sections
        ?.map((s: any) => (s.heading ? `${s.heading}\n${s.content}` : s.content))
        .join("\n\n") ??
      "";

    while (attempt <= maxRetries && !parsed) {
      attempt++;
      try {
        const llmResponse = await polishPrompt({
          blogTitle,
          topic,
          tone: tone,
          fullDraft: draftText,
          meta: meta,
        });

        const rawResponse = llmResponse.text;
        console.log(`[r5_polish] Raw AI response (attempt ${attempt}):`, rawResponse);

        const tempParsed = safeParseJsonFromAI(rawResponse);
        if (tempParsed) {
            tempParsed.pipelineId = pipelineId;
            r5_polish_output.parse(tempParsed);
            parsed = tempParsed as z.infer<typeof r5_polish_output>;
        } else {
            console.warn(`[r5_polish] Invalid JSON structure (attempt ${attempt})`);
        }
      } catch (err) {
        console.error(`[r5_polish] Error parsing or validating AI response (attempt ${attempt}):`, err);
      }
    }

    if (parsed && (!parsed.usedImages || parsed.usedImages.length === 0)) {
        console.warn("[r5_polish] No images were used in output");
    }

    if (!parsed) {
      console.warn("[r5_polish] Fallback: using raw input as polished output");
      parsed = {
        pipelineId,
        polishedBlog: draftText,
        readability: { fkGrade: 55 },
        usedImages: [],
      };
    }

    const storageResult = await ai.run('Round5_Polish_Storage', async () => {
        const args = { pipelineId, round: 'r5', data: parsed, inputMeta: input };
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
            console.error(`[r5_polish:Round5_Storage] persistRoundOutput failed:`, err);
            const errorMessage = err instanceof Error ? err.stack : String(err);
            return {
                ok: false,
                pipelineId: pId,
                round,
                error: errorMessage,
                startedAt,
                finishedAt: new Date().toISOString(),
            };
        }
      });
      
      console.log({
        flow: 'r5_polish',
        stage: 'storage_complete',
        message: '✅ Storage operation completed',
        pipelineId: input.pipelineId,
        gcsPath: storageResult?.persistResult?.gcsPath,
      });

      const finalOutput = {
          ...parsed,
          __storage: storageResult,
      };

      return finalOutput;
  }
);
