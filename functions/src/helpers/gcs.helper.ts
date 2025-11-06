/**
 * gcs.helpers.ts
 * -----------------
 * Utility functions for consistent GCS path generation and round mapping.
 */

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || "ai-blog-bucket";

/** Map round → subfolder */
export function getRoundFolder(round: string): string {
  const map: Record<string, string> = {
    r0: "trends",
    r1: "topic",
    r2: "outline",
    r3: "draft",
    r4: "meta",
    r5: "polished",
    r6: "social",
    r7: "evaluation",
    r8: "published",
  };
  return map[round] || "misc";
}

/** Generate canonical GCS file path */
export function makeGCSPath(pipelineId: string, round: string, ext = "json"): string {
  const roundFolder = getRoundFolder(round);
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const date = `${year}-${month}`;
  const pipelineFolder = `${pipelineId}`;
  const fileName = `${round}_${roundFolder}.${ext}`;
  return `gs://${GCS_BUCKET_NAME}/${date}/${pipelineFolder}/${fileName}`;
}
