/**
 * gcs.helpers.ts
 * -----------------
 * Utility functions for consistent GCS path generation and round mapping.
 */

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'ai-blog-bucket';

/** Map round → subfolder */
export function getRoundFolder(round: string): string {
  const map: Record<string, string> = {
    r0: 'topics',
    r1: 'topics',
    r2: 'outlines',
    r3: 'outlines',
    r4: 'meta',
    r5: 'polished',
    r6: 'social',
    r7: 'evaluation',
    r8: 'published',
  };
  return map[round] || 'misc';
}

/** Generate canonical GCS file path */
export function makeGCSPath(pipelineId: string, round: string, ext = 'json'): string {
  const roundFolder = getRoundFolder(round);
  const pipelineFolder = `${pipelineId}`
  const fileName = `${round}.${ext}`;
  return `gs://${GCS_BUCKET_NAME}/${roundFolder}/${pipelineFolder}/${fileName}`;
}
