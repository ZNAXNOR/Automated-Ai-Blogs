import { ai } from '../../clients/genkitInstance.client';
import { persistRoundOutput } from '../../adapters/roundStorage.adapter';

export const round2StorageStep = async (pipelineId: string, data: any) => {
  return await ai.run('Round2_Storage', async () => {
    const args = { pipelineId, round: 'r2', data };
    const { pipelineId: pId, round, data: roundData } = args;
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
};
