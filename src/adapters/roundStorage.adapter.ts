import { db } from '../clients/firebase/firestore.client';
import { bucket } from '../clients/firebase/gcs.client';
import { makeGCSPath } from '../helpers/gcs.helper';
import { writeBatch, doc, getDoc } from 'firebase/firestore';

interface PersistResult {
  pipelineId: string;
  round: string;
  gcsPath: string;
  publicUrl: string;
  firestorePaths: string[];
  message: string;
}

export async function persistRoundOutput(
  pipelineId: string,
  round: string,
  data: any
): Promise<PersistResult> {
  const gcsPath = makeGCSPath(pipelineId, round);
  const file = bucket.file(gcsPath.replace(`gs://${bucket.name}/`, ''));
  await file.save(JSON.stringify(data, null, 2), {
    resumable: false,
    gzip: true,
    metadata: { contentType: 'application/json' },
  });
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
  const createdAt = new Date().toISOString();
  const batch = writeBatch(db);
  const firestorePaths: string[] = [];
  const pipelineRef = doc(db, 'pipelines', pipelineId);
  firestorePaths.push(pipelineRef.path);

  const pipelineUpdateData: { [key: string]: any } = {
    pipelineId,
    updatedAt: createdAt
  };

  switch (round) {
    case 'r0':
    case 'r1':
      const topicRef = doc(db, 'topics', pipelineId);
      const topicData = {
        pipelineId,
        title: data.topic || data.title || 'Untitled Topic',
        ...data,
        updatedAt: createdAt,
      };
      batch.set(topicRef, JSON.parse(JSON.stringify(topicData)), { merge: true });
      firestorePaths.push(topicRef.path);
      pipelineUpdateData.topicRef = topicRef;
      pipelineUpdateData.title = topicData.title;
      break;

    case 'r2': {
      const metaRef = doc(db, 'metadata', pipelineId);
      const roundMetadata = {
        researchNotes: data.researchNotes,
      };
      if (data.outline?.title) {
        pipelineUpdateData.title = data.outline.title;
      }
      const dataToSet = { pipelineId, ...roundMetadata, updatedAt: createdAt };
      const sanitizedData = JSON.parse(JSON.stringify(dataToSet));
      batch.set(metaRef, sanitizedData, { merge: true });
      firestorePaths.push(metaRef.path);
      pipelineUpdateData.metadataRef = metaRef;
      break;
    }
    case 'r4':
    case 'r8': {
      const metaRef = doc(db, 'metadata', pipelineId);
      const roundMetadata = {
        title: data.title,
        slug: data.slug,
        tags: data.tags,
        category: data.category,
        status: data.status || (round === 'r8' ? 'published' : 'in_review'),
        ...data,
      };
      pipelineUpdateData.title = data.title;
      pipelineUpdateData.status = data.status || (round === 'r8' ? 'published' : 'in_review');

      const dataToSet = { pipelineId, ...roundMetadata, updatedAt: createdAt };
      const sanitizedData = JSON.parse(JSON.stringify(dataToSet));

      batch.set(metaRef, sanitizedData, { merge: true });
      firestorePaths.push(metaRef.path);
      pipelineUpdateData.metadataRef = metaRef;
      break;
    }
  }

  batch.set(pipelineRef, JSON.parse(JSON.stringify(pipelineUpdateData)), { merge: true });
  await batch.commit();

  return {
    pipelineId,
    round,
    gcsPath,
    publicUrl,
    firestorePaths,
    message: `Round ${round} persisted. Firestore documents updated: ${firestorePaths.join(', ')}`.trim(),
  };
}

export async function getPipelineSummary(pipelineId: string) {
  const docRef = doc(db, 'pipelines', pipelineId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return docSnap.data();
}

export async function verifyRoundBlob(pipelineId: string, round: string) {
  const gcsPath = makeGCSPath(pipelineId, round);
  const file = bucket.file(gcsPath.replace(`gs://${bucket.name}/`, ''));
  const [exists] = await file.exists();
  return { exists, gcsPath };
}