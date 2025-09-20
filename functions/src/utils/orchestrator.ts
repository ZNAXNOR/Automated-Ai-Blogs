import * as R0 from '../rounds/r0_trends';
import * as R1 from '../rounds/r1_ideate';
import * as R2 from '../rounds/r2_outline';
import * as R3 from '../rounds/r3_draft';
import * as R4 from '../rounds/r4_polish';
import * as R5 from '../rounds/r5_meta';
import * as R6 from '../rounds/r6_coherence';
import * as R7 from '../rounds/r7_publish';

import { JobPayload } from './types';

interface PipelineResult {
  payload: JobPayload;
  status: 'completed' | 'failed';
  error?: string;
  wpPostUrl?: string;
  wpPostId?: number;
}

export async function runPipeline(initialTrendInput: any): Promise<PipelineResult> {
  const payload: JobPayload = {
    trendInput: initialTrendInput
  };

  try {
    const out0 = await R0.run(payload);
    Object.assign(payload, out0);

    const out1 = await R1.run(payload);
    Object.assign(payload, out1);

    const out2 = await R2.run(payload);
    Object.assign(payload, out2);

    const out3 = await R3.run(payload);
    Object.assign(payload, out3);

    const out4 = await R4.run(payload);
    Object.assign(payload, out4);

    const out5 = await R5.run(payload);
    Object.assign(payload, out5);

    const out6 = await R6.run(payload);
    Object.assign(payload, out6);

    const out7 = await R7.run(payload);
    Object.assign(payload, { wpPostUrl: out7.wpPostUrl, wpPostId: out7.wpPostId });

    return {
      payload,
      status: 'completed',
      wpPostUrl: out7.wpPostUrl,
      wpPostId: out7.wpPostId
    };
  } catch (err: any) {
    return {
      payload,
      status: 'failed',
      error: err.message
    };
  }
}
