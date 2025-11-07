/**
 * gcs.client.ts
 * --------------
 * Initializes a Google Cloud Storage client for a production environment.
 * Provides upload and delete helpers.
 */

import {Storage, StorageOptions, Bucket} from "@google-cloud/storage";
import {defineSecret} from "firebase-functions/params";
import path from "path";
import {GCP_PROJECT_ID_CONFIG} from "@src/index.js";
import { GCS_BUCKET_NAME_CONFIG } from "@src/index.js";

// ---- Local Imports ----
import {GCSUploadResult} from "@src/interfaces/gcs.interface.js";
import {makeGCSPath} from "@src/helpers/gcs.helper.js";
import {GCSArtifactSchema} from "@src/schemas/storage/gcs.schema.js";

// --- Environment Variables & Secret Definition ---
const gcpServiceAccountJsonSecret = defineSecret("GCP_SERVICE_ACCOUNT_JSON");

let bucketInstance: Bucket | null = null;

function getStorageBucket(): Bucket {
  if (bucketInstance) {
    return bucketInstance;
  }

  const projectId = GCP_PROJECT_ID_CONFIG.value();
  const bucketName = GCS_BUCKET_NAME_CONFIG.value();

  if (!bucketName) {
    throw new Error("Missing GCS_BUCKET_NAME environment variable");
  }

  const storageConfig: StorageOptions = {projectId};

  const secretValue = gcpServiceAccountJsonSecret.value();
  if (!secretValue) {
      throw new Error("GCP_SERVICE_ACCOUNT_JSON secret is not available. Ensure it is set in your Firebase environment.");
  }

  try {
      storageConfig.credentials = JSON.parse(secretValue);
  } catch(e) {
      throw new Error("Failed to parse GCP_SERVICE_ACCOUNT_JSON secret. Ensure it is valid JSON.");
  }

  const storage = new Storage(storageConfig);
  bucketInstance = storage.bucket(bucketName);
  console.log("[GCS] Storage bucket client initialized for production.");
  return bucketInstance;
}

export {getStorageBucket as bucket};


/**
 * Uploads a local file to GCS.
 * - Automatically compresses with gzip.
 * - Optionally makes the file public.
 * - Returns structured GCSUploadResult metadata.
 * @param {string} localPath The local path to the file.
 * @param {string} destination The destination path in GCS.
 * @param {boolean} makePublic Whether to make the file public.
 * @return {Promise<GCSUploadResult>} A promise that resolves to
 * the upload result.
 */
export async function uploadFile(
  localPath: string,
  destination: string,
  makePublic = true
): Promise<GCSUploadResult> {
  const bucket = getStorageBucket();
  console.log(
    `[GCS] Uploading ${localPath} to gs://${bucket.name}/${destination}...`
  );
  await bucket.upload(localPath, {
    destination,
    gzip: true,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  const file = bucket.file(destination);

  if (makePublic) {
    await file.makePublic();
  }

  const [metadata] = await file.getMetadata();
  const publicUrl =
    `https://storage.googleapis.com/${bucket.name}/${destination}`;

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
 * @param {string} destination The destination path in GCS.
 * @return {Promise<void>} A promise that resolves when the file is deleted.
 */
export async function deleteFile(destination: string): Promise<void> {
  const bucket = getStorageBucket();
  console.log(`[GCS] Deleting gs://${bucket.name}/${destination}...`);
  await bucket.file(destination).delete({ignoreNotFound: true});
}

/**
 * Uploads a pipeline round artifact to its canonical GCS path.
 * Validates the metadata using GCSArtifactSchema.
 * @param {string} pipelineId The pipeline ID.
 * @param {string} round The round.
 * @param {string} localFilePath The local file path.
 * @param {string} [description] The description.
 * @return {Promise<void>} A promise that resolves when the artifact
 * is uploaded.
 */
export async function uploadArtifact(
  pipelineId: string,
  round: string,
  localFilePath: string,
  description?: string
): Promise<void> {
  const bucket = getStorageBucket();
  console.log(
    `[GCS] Uploading artifact for pipeline ${pipelineId}, round ${round}...`
  );
  const destination = makeGCSPath(
    pipelineId, round, "json").replace(`gs://${bucket.name}/`, "");
  const result = await uploadFile(localFilePath, destination, true);

  // Construct metadata and validate
  const artifact = {
    pipelineId,
    round,
    bucketPath: result.gcsPath,
    createdAt: new Date().toISOString(),
    sizeBytes: result.sizeBytes,
    contentType: "application/json",
    description,
  };

  const parsed = GCSArtifactSchema.safeParse(artifact);
  if (!parsed.success) {
    console.error(
      "Invalid GCS artifact metadata:", parsed.error.format());
    throw new Error("Invalid GCS artifact metadata");
  }

  console.log(
    `[GCS Upload] ✅ Uploaded ${pipelineId}_${round} → ${result.publicUrl}`
  );
}
