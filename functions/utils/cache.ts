/**
 * Simple Firestore cache with TTL.
 * Documents under collection `cache` with nested keys like `serpapi/{hash}`.
 *
 * Shape:
 *  {
 *    payload: any,
 *    createdAt: Timestamp,
 *    expiresAt: Timestamp
 *  }
 */

import * as admin from "firebase-admin";
import { env } from "./config";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

export async function getCache(pathKey: string): Promise<{ payload: any } | null> {
  // pathKey example: "serpapi:abcd" -> doc path "cache/serpapi:abcd"
  const ref = db.doc(`cache/${pathKey}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  const expiresAt = data.expiresAt?.toDate?.() ?? new Date(0);
  if (expiresAt.getTime() < Date.now()) return null;
  return { payload: data.payload };
}

export async function setCache(pathKey: string, payload: any, ttlHours?: number): Promise<void> {
  const hours = (ttlHours ?? env.CACHE_TTL_HOURS ?? 24);
  const now = new Date();
  const expires = new Date(now.getTime() + hours * 3600 * 1000);
  const ref = db.doc(`cache/${pathKey}`);
  await ref.set({
    payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expires),
  });
}
