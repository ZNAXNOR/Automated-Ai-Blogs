/**
 * gcs.client.ts
 * --------------
 * Initializes a Google Cloud Storage client.
 * Provides upload and delete helpers.
 */

import { Storage, StorageOptions } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';

// ---- Local Imports ----
import { GCSUploadResult } from '@src/interfaces/gcs.interface';
import { makeGCSPath } from '@src/helpers/gcs.helper';
import { GCSArtifactSchema } from '@src/schemas/storage/gcs.schema';

// --- Environment Variables & Client Initialization ---
const projectId = process.env.GCP_PROJECT_ID;
const bucketName = process.env.GCS_BUCKET_NAME;
const serviceAccountPath = process.env.GCP_SERVICE_ACCOUNT_JSON;
const isEmulator = process.env.USE_FIREBASE_EMULATOR === 'true';

const storageConfig: StorageOptions = { projectId };

if (isEmulator) {
  console.log('⚙️ Using GCS Emulator (Firebase Storage) at localhost:9199');
  storageConfig.apiEndpoint = 'http://localhost:9199';
  process.env.GOOGLE_CLOUD_DISABLE_CERT_VALIDATION = 'true';
} else {
  if (!serviceAccountPath) throw new Error('Missing GCP_SERVICE_ACCOUNT_JSON environment variable');
  if (!fs.existsSync(serviceAccountPath)) throw new Error(`Missing service account file: ${serviceAccountPath}`);
  storageConfig.keyFilename = serviceAccountPath;
}

if (!bucketName) throw new Error('Missing GCS_BUCKET_NAME environment variable');

const storage = new Storage(storageConfig);
export const bucket = storage.bucket(bucketName);

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

/**
 * Example usage:
 * 
 * import { uploadArtifact, deleteFile } from './gcs.client';
 * 
 * await uploadArtifact('abc12345', 'r4', './tmp/meta.json', 'Metadata output for round 4');
 * await deleteFile('meta/abc12345_r4.json');
 */