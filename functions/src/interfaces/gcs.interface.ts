/**
 * gcs.interface.ts
 * -----------------
 * Type interfaces for GCS blob metadata and artifact operations.
 */

export interface GCSArtifactMeta {
    pipelineId: string;
    round: string; // e.g., "r0", "r4", "r8"
    bucketPath: string; // e.g., "gs://ai-blog-bucket/meta/abc12345_r4.json"
    createdAt: string;
    sizeBytes?: number;
    contentType?: string;
    description?: string;
  }

export interface GCSUploadResult {
    publicUrl: string;
    gcsPath: string;
    bucket: string;
    name: string;
    sizeBytes: number;
  }
