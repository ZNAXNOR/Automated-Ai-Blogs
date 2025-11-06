/**
 * gcs.schema.ts
 * -----------------
 * Zod schema for validating GCS blob metadata.
 */

import {z} from "zod";

export const GCSArtifactSchema = z.object({
  pipelineId: z.string(),
  round: z.string().regex(/^r[0-8]$/, "Round must be between r0 and r8"),
  bucketPath: z.string(),
  createdAt: z.string().datetime(),
  sizeBytes: z.number().optional(),
  contentType: z.string().optional(),
  description: z.string().optional(),
});

export type GCSArtifact = z.infer<typeof GCSArtifactSchema>;
