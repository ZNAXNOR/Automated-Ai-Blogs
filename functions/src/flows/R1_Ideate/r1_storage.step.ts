import { ai } from '../../clients/genkitInstance.client.js';
import { persistRoundOutput } from '../../adapters/roundStorage.adapter.js';

export const round1StorageStep = async (pipelineId: string, ideationObj: any, parsedInput: any) => {
  return await ai.run('Round1_Storage', async () => {
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
};