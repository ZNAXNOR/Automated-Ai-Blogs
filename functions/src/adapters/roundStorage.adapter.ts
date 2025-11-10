import { getDb } from '@clients/firebase/firestore.client.js';
import { getBucket } from '@clients/firebase/gcs.client.js';
import { makeGCSPath } from '@src/helpers/gcs.helper.js';
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
  const db = getDb();
  const bucket = getBucket();
  const gcsPath = makeGCSPath(pipelineId, round);
  const gcsStoragePath = `gs://${bucket.name}/pipelines/${pipelineId}`;
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
    updatedAt: createdAt,
    gcsStoragePath,
  };

  switch (round) {      
    case 'r1':
      const topicRef = doc(db, 'usedTopics', data.topic.toLowerCase(), 'details', pipelineId);
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
    case 'r5': {
        const metaRef = doc(db, 'metadata', pipelineId);
        
        // Destructure image-related fields and keep the rest
        const {
            featuredImage,
            usedImages,
            polishedBlog,
            ...restOfData
        } = data;

        // Prepare the data for setting in Firestore
        const updatePayload: { [key: string]: any } = {
            pipelineId,
            ...restOfData, // Spread the non-image fields
            updatedAt: createdAt,
        };

        // Use dot notation to update nested fields within the 'images' map.
        // This ensures we can add/update image fields without overwriting the whole map.
        if (featuredImage) {
            updatePayload['images.featured'] = featuredImage;
        }
        if (usedImages) {
            updatePayload['images.used'] = usedImages;
        }

        const sanitizedData = JSON.parse(JSON.stringify(updatePayload));

        batch.set(metaRef, sanitizedData, { merge: true });
        firestorePaths.push(metaRef.path);
        pipelineUpdateData.metadataRef = metaRef;
        break;
    }

    case 'r8': {
      const metaRef = doc(db, 'metadata', pipelineId);
      const roundMetadata = {
        wordpressLink: data.output?.link,
        status: data.output?.status || 'published',
      };
      
      pipelineUpdateData.title = data.input?.meta?.title;
      pipelineUpdateData.status = data.output?.status || 'published';
      pipelineUpdateData.wordpressLink = data.output?.link;

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
  const db = getDb();
  const docRef = doc(db, 'pipelines', pipelineId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return docSnap.data();
}

export async function verifyRoundBlob(pipelineId: string, round: string) {
  const bucket = getBucket();
  const gcsPath = makeGCSPath(pipelineId, round);
  const file = bucket.file(gcsPath.replace(`gs://${bucket.name}/`, ''));
  const [exists] = await file.exists();
  return { exists, gcsPath };
}
