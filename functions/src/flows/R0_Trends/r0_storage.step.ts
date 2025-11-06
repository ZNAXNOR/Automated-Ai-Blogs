import {ai} from "../../clients/genkitInstance.client.js";
import {persistRoundOutput} from "../../adapters/roundStorage.adapter.js";
import {r0TrendsOutput} from "../../schemas/flows/r0_trends.schema.js";
import {z} from "zod";

export const round0StorageStep = async (
  pipelineId: string, data: z.infer<typeof r0TrendsOutput>
) => {
  return await ai.run("Round0_Storage", async () => {
    const args = {pipelineId, round: "r0", data};
    const {pipelineId: pId, round, data: roundData} = args;
    const startedAt = new Date().toISOString();

    try {
      const persistResult = await persistRoundOutput(
        pId, round, roundData as z.infer<typeof r0TrendsOutput>
      );
      return {
        ok: true,
        pipelineId: pId,
        round,
        persistResult,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error(
        "[r0_trends:Round0_Storage] persistRoundOutput failed:",
        err
      );
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
};
