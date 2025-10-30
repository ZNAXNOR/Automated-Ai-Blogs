/**
 * roundStorage.adapter.ts
 * ------------------------
 * Unified adapter for storing pipeline round outputs across Firestore and GCS.
 *
 * Firestore:
 *   - topics/     → stores r0 & r1 summaries
 *   - metadata/   → stores r4 & r8 CMS/SEO metadata
 *   - pipelines/  → global orchestrator index (stores references to GCS blobs)
 *
 * GCS:
 *   - round-based folder segregation
 *   - canonical naming via makeGCSPath(pipelineId, round)
 */

import { db } from '../clients/firebase/firestore.client';
import { bucket } from '../clients/firebase/gcs.client';
import { makeGCSPath } from '../helpers/gcs.helper';
import { GCSArtifactSchema } from '../schemas/storage/gcs.schema';
import type { GCSUploadResult } from '../interfaces/gcs.interface';
import { writeBatch, doc, getDoc } from 'firebase/firestore';

interface PersistResult {
  pipelineId: string;
  round: string;
  gcsPath: string;
  publicUrl: string;
  firestoreRefs: string[];
  message: string;
}

/**
 * Main entry: store both Firestore and GCS data for a round.
 * Automatically uploads large data to GCS and stores compact references in Firestore.
 */
export async function persistRoundOutput(
  pipelineId: string,
  round: string,
  data: any
): Promise<PersistResult> {
  // --- Create canonical GCS path ---
  const gcsPath = makeGCSPath(pipelineId, round);
  const file = bucket.file(gcsPath.replace(`gs://${bucket.name}/`, ''));

  // --- Upload blob to GCS ---
  await file.save(JSON.stringify(data, null, 2), {
    resumable: false,
    gzip: true,
    metadata: { contentType: 'application/json' },
  });

  const [metadata] = await file.getMetadata();
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

  // --- Validate and build GCS artifact meta ---
  const artifact = GCSArtifactSchema.parse({
    pipelineId,
    round,
    bucketPath: gcsPath,
    createdAt: new Date().toISOString(),
    sizeBytes: metadata.size ? Number(metadata.size) : undefined,
    contentType: metadata.contentType,
  });

  // --- Firestore updates ---
  const firestoreRefs: string[] = [];
  const batch = writeBatch(db);

  // 1️⃣ Update global pipeline index
  const pipelineRef = doc(db, 'pipelines', pipelineId);
  batch.set(
    pipelineRef,
    {
      pipelineId,
      [round]: {
        storageRef: gcsPath,
        sizeBytes: artifact.sizeBytes,
        updatedAt: artifact.createdAt,
      },
      updatedAt: artifact.createdAt,
    },
    { merge: true }
  );
  firestoreRefs.push(pipelineRef.path);

  // 2️⃣ Topic and metadata segregation
  if (round === 'r0' || round === 'r1') {
    const topicRef = doc(db, 'topics', pipelineId);
    batch.set(
      topicRef,
      {
        pipelineId,
        round,
        title: data.title ?? data.topic ?? 'Untitled',
        summary: data.summary ?? null,
        storageRef: gcsPath,
        createdAt: artifact.createdAt,
      },
      { merge: true }
    );
    firestoreRefs.push(topicRef.path);
  }

  if (round === 'r4' || round === 'r8') {
    const metaRef = doc(db, 'metadata', pipelineId);
    batch.set(
      metaRef,
      {
        pipelineId,
        round,
        slug: data.slug ?? null,
        tags: data.tags ?? [],
        seoTitle: data.seoTitle ?? null,
        status: data.status ?? (round === 'r8' ? 'published' : 'in_review'),
        language: data.lang ?? 'en',
        storageRef: gcsPath,
        updatedAt: artifact.createdAt,
      },
      { merge: true }
    );
    firestoreRefs.push(metaRef.path);
  }

  // --- Commit all Firestore writes ---
  await batch.commit();

  return {
    pipelineId,
    round,
    gcsPath,
    publicUrl,
    firestoreRefs,
    message: `Round ${round} persisted successfully.`,
  };
}

/**
 * Utility: retrieve orchestrated pipeline overview
 * Returns the Firestore doc with references to all rounds.
 */
export async function getPipelineSummary(pipelineId: string) {
  const docRef = doc(db, 'pipelines', pipelineId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return docSnap.data();
}

/**
 * Utility: link-check a round in GCS
 */
export async function verifyRoundBlob(pipelineId: string, round: string) {
  const gcsPath = makeGCSPath(pipelineId, round);
  const file = bucket.file(gcsPath.replace(`gs://${bucket.name}/`, ''));
  const [exists] = await file.exists();
  return { exists, gcsPath };
}
