import {db} from "../clients/firebase/firestore.client";
import {bucket} from "../clients/firebase/gcs.client";
import {makeGCSPath} from "../helpers/gcs.helper";
import {writeBatch, doc, getDoc} from "firebase/firestore";

interface PersistResult {
  pipelineId: string;
  round: string;
  gcsPath: string;
  publicUrl: string;
  firestorePaths: string[];
  message: string;
}

/**
 * Persists the output of a round to GCS and Firestore.
 * @param {string} pipelineId - The ID of the pipeline.
 * @param {string} round - The round number.
 * @param {Record<string, unknown>} data - The data to persist.
 * @return {Promise<PersistResult>} - The result of the persistence operation.
 */
export async function persistRoundOutput(
  pipelineId: string,
  round: string,
  data: Record<string, unknown>
): Promise<PersistResult> {
  const gcsPath = makeGCSPath(pipelineId, round);
  const gcsStoragePath = `gs://${bucket.name}/pipelines/${pipelineId}`;
  const file = bucket.file(gcsPath.replace(`gs://${bucket.name}/`, ""));
  await file.save(JSON.stringify(data, null, 2), {
    resumable: false,
    gzip: true,
    metadata: {contentType: "application/json"},
  });
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
  const createdAt = new Date().toISOString();
  const batch = writeBatch(db);
  const firestorePaths: string[] = [];
  const pipelineRef = doc(db, "pipelines", pipelineId);
  firestorePaths.push(pipelineRef.path);

  const pipelineUpdateData: {[key: string]: unknown} = {
    pipelineId,
    updatedAt: createdAt,
    gcsStoragePath,
  };

  switch (round) {
  case "r1": {
    const topicRef = doc(
      db,
      "usedTopics",
      (data.topic as string).toLowerCase(),
      "details",
      pipelineId
    );
    const topicData = {
      pipelineId,
      title: data.topic || data.title || "Untitled Topic",
      ...data,
      updatedAt: createdAt,
    };
    batch.set(topicRef, JSON.parse(JSON.stringify(topicData)), {merge: true});
    firestorePaths.push(topicRef.path);
    pipelineUpdateData.topicRef = topicRef;
    pipelineUpdateData.title = topicData.title;
    break;
  }
  case "r2": {
    const metaRef = doc(db, "metadata", pipelineId);
    const roundMetadata = {
      researchNotes: data.researchNotes,
    };
    if ((data.outline as {title: string})?.title) {
      pipelineUpdateData.title = (data.outline as {title: string}).title;
    }
    const dataToSet = {pipelineId, ...roundMetadata, updatedAt: createdAt};
    const sanitizedData = JSON.parse(JSON.stringify(dataToSet));
    batch.set(metaRef, sanitizedData, {merge: true});
    firestorePaths.push(metaRef.path);
    pipelineUpdateData.metadataRef = metaRef;
    break;
  }
  case "r4":
  case "r5": {
    const metaRef = doc(db, "metadata", pipelineId);

    const {
      featuredImage,
      usedImages,
      ...restOfData
    } = data;

    const updatePayload: {[key: string]: unknown} = {
      pipelineId,
      ...restOfData,
      updatedAt: createdAt,
    };

    if (featuredImage) {
      updatePayload["images.featured"] = featuredImage;
    }
    if (usedImages) {
      updatePayload["images.used"] = usedImages;
    }

    const sanitizedData = JSON.parse(JSON.stringify(updatePayload));

    batch.set(metaRef, sanitizedData, {merge: true});
    firestorePaths.push(metaRef.path);
    pipelineUpdateData.metadataRef = metaRef;
    break;
  }
  case "r8": {
    const metaRef = doc(db, "metadata", pipelineId);
    const roundMetadata = {
      wordpressLink: (data.output as {link: string})?.link,
      status: (data.output as {status: string})?.status || "published",
    };

    pipelineUpdateData.title = (data.input as {meta: {title: string}})?.meta
      ?.title;
    pipelineUpdateData.status =
        (data.output as {status: string})?.status || "published";
    pipelineUpdateData.wordpressLink = (data.output as {link: string})?.link;

    const dataToSet = {pipelineId, ...roundMetadata, updatedAt: createdAt};
    const sanitizedData = JSON.parse(JSON.stringify(dataToSet));

    batch.set(metaRef, sanitizedData, {merge: true});
    firestorePaths.push(metaRef.path);
    pipelineUpdateData.metadataRef = metaRef;
    break;
  }
  }

  batch.set(
    pipelineRef,
    JSON.parse(JSON.stringify(pipelineUpdateData)),
    {merge: true}
  );
  await batch.commit();

  return {
    pipelineId,
    round,
    gcsPath,
    publicUrl,
    firestorePaths,
    message: `Round ${round} persisted. ` +
      `Firestore docs updated: ${firestorePaths.join(", ")}`.trim(),
  };
}

/**
 * Gets the summary of a pipeline from Firestore.
 * @param {string} pipelineId - The ID of the pipeline.
 * @return {Promise<any>} - The pipeline summary data.
 */
export async function getPipelineSummary(pipelineId: string) {
  const docRef = doc(db, "pipelines", pipelineId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return docSnap.data();
}

/**
 * Verifies if a blob for a given round exists in GCS.
 * @param {string} pipelineId - The ID of the pipeline.
 * @param {string} round - The round number.
 * @return {Promise<{exists: boolean, gcsPath: string}>} -
 * An object with blob existence and GCS path.
 */
export async function verifyRoundBlob(pipelineId: string, round: string) {
  const gcsPath = makeGCSPath(pipelineId, round);
  const file = bucket.file(gcsPath.replace(`gs://${bucket.name}/`, ""));
  const [exists] = await file.exists();
  return {exists, gcsPath};
}
