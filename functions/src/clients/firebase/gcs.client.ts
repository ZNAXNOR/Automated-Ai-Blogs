/**
 * gcs.client.ts
 * --------------
 * Initializes a Google Cloud Storage client.
 * Provides upload and delete helpers.
 */

import { Storage, StorageOptions, Bucket } from '@google-cloud/storage';
import { GCS_BUCKET_NAME_CONFIG, GCP_SERVICE_ACCOUNT_JSON_SECRET } from "@src/config.js";
import path from 'path';

// ---- Local Imports ----
import { GCSUploadResult } from '@src/interfaces/gcs.interface.js';
import { makeGCSPath } from '@src/helpers/gcs.helper.js';
import { GCSArtifactSchema } from '@src/schemas/storage/gcs.schema.js';

let storage: Storage;
let bucketInstance: Bucket;

export function getBucket() {
  if (!bucketInstance) {
    const storageConfig: StorageOptions = {};
    const serviceAccount = GCP_SERVICE_ACCOUNT_JSON_SECRET.value();
    if (!serviceAccount) throw new Error('Missing GCP_SERVICE_ACCOUNT_JSON secret');
    storageConfig.credentials = JSON.parse(serviceAccount);

    const bucketName = GCS_BUCKET_NAME_CONFIG.value();
    if (!bucketName) throw new Error('Missing GCS_BUCKET_NAME secret');

    storage = new Storage(storageConfig);
    bucketInstance = storage.bucket(bucketName);
  }
  return bucketInstance;
}

/**
 * Uploads a local file to GCS.
 * - Automatically compresses with gzip.
 * - Optionally makes the file public.
 * - Returns structured GCSUploadResult metadata.
 */
export async function uploadFile(
  localPath: string,
  destination: string,
  makePublic = true
): Promise<GCSUploadResult> {
  const bucket = getBucket();
  console.log(`[GCS] Uploading ${localPath} to gs://${bucket.name}/${destination}...`);
  await bucket.upload(localPath, {
    destination,
    gzip: true,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  const file = bucket.file(destination);

  if (makePublic) {
    await file.makePublic();
  }

  const [metadata] = await file.getMetadata();
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
  
  console.log(`[GCS] Upload successful: ${publicUrl}`);

  return {
    publicUrl,
    gcsPath: `gs://${bucket.name}/${destination}`,
    bucket: bucket.name,
    name: path.basename(destination),
    sizeBytes: Number(metadata.size),
  };
}

/**
 * Deletes a file from GCS.
 * Ignores missing files by default.
 */
export async function deleteFile(destination: string): Promise<void> {
  const bucket = getBucket();
  console.log(`[GCS] Deleting gs://${bucket.name}/${destination}...`);
  await bucket.file(destination).delete({ ignoreNotFound: true });
}

/**
 * Uploads a pipeline round artifact to its canonical GCS path.
 * Validates the metadata using GCSArtifactSchema.
 */
export async function uploadArtifact(
  pipelineId: string,
  round: string,
  localFilePath: string,
  description?: string
): Promise<void> {
  const bucket = getBucket();
  console.log(`[GCS] Uploading artifact for pipeline ${pipelineId}, round ${round}...`);
  const destination = makeGCSPath(pipelineId, round, 'json').replace(`gs://${bucket.name}/`, '');
  const result = await uploadFile(localFilePath, destination, true);

  // Construct metadata and validate
  const artifact = {
    pipelineId,
    round,
    bucketPath: result.gcsPath,
    createdAt: new Date().toISOString(),
    sizeBytes: result.sizeBytes,
    contentType: 'application/json',
    description,
  };

  const parsed = GCSArtifactSchema.safeParse(artifact);
  if (!parsed.success) {
    console.error('Invalid GCS artifact metadata:', parsed.error.format());
    throw new Error('Invalid GCS artifact metadata');
  }

  console.log(`[GCS Upload] ✅ Uploaded ${pipelineId}_${round} → ${result.publicUrl}`);
}
