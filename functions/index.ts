// functions/src/index.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { runPipeline } from './src/utils/orchestrator';

admin.initializeApp();

export const triggerMvpBlog = functions.https.onRequest(async (req, res) => {
  // Optionally accept a seed input from req.body
  const seedInput = req.body?.seed || null;

  // For visibility: create a Firestore job doc
  const jobRef = await admin.firestore().collection('mvp_jobs').add({
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    seedInput
  });

  try {
    const result = await runPipeline(seedInput);

    await jobRef.update({
      status: result.status,
      payload: result.payload,
      wpPostUrl: result.wpPostUrl || null,
      wpPostId: result.wpPostId || null,
      error: result.error || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ jobId: jobRef.id, result });
  } catch (err: any) {
    await jobRef.update({
      status: 'failed',
      error: err.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(500).json({ error: err.message });
  }
});
