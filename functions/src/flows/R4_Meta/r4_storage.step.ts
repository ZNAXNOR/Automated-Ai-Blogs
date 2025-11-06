import {ai} from "../../clients/genkitInstance.client";
import {persistRoundOutput} from "../../adapters/roundStorage.adapter";

export const round4StorageStep = async (pipelineId: string, data: any) => {
  return await ai.run("Round4_Storage", async () => {
    const args = {pipelineId, round: "r4", data};
    const {pipelineId: pId, round, data: roundData} = args;
    const startedAt = new Date().toISOString();

    try {
      const persistResult = await persistRoundOutput(pId, round, roundData);
      return {
        ok: true,
        pipelineId: pId,
        round,
        persistResult,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error("[r4_meta:Round4_Storage] persistRoundOutput failed:", err);
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
