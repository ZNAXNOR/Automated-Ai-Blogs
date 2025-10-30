/**
 * firebaseEmulator.config.ts
 * -------------------------------------------------
 * Centralized configuration adaptor for Firebase Emulators.
 * Detects environment and connects Firestore + Storage
 * clients to local emulators if enabled.
 *
 * Usage:
 *   import { setupFirebaseEmulators } from './firebase.emulator.config';
 *   setupFirebaseEmulators({ db, storage });
 */

import { Firestore } from 'firebase-admin/firestore';
import type { Storage } from '@google-cloud/storage';

interface EmulatorOptions {
  db?: Firestore;
  storage?: Storage;
}

/**
 * Setup Firebase Emulators for Firestore and Storage
 * --------------------------------------------------
 * When `USE_FIREBASE_EMULATOR=true` in `.env`, this will:
 *   - Redirect Firestore to localhost:8080
 *   - Redirect Firebase Storage to localhost:9199
 */
export function setupFirebaseEmulators({ db, storage }: EmulatorOptions): void {
  const useEmulator = process.env.USE_FIREBASE_EMULATOR === 'true';

  if (!useEmulator) {
    console.log('🔥 Firebase Emulators disabled — using production services');
    return;
  }

  console.log('⚙️ Firebase Emulator mode enabled');

  // ---- Firestore Emulator ----
  if (db) {
    try {
      db.settings({
        host: 'localhost:8080',
        ssl: false,
      });
      console.log('📘 Connected Firestore → localhost:8080');
    } catch (err) {
      console.warn('⚠️ Failed to connect Firestore emulator:', err);
    }
  }

  // ---- Storage Emulator ----
  if (storage) {
    try {
      process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
      console.log('📦 Connected Firebase Storage → localhost:9199');
    } catch (err) {
      console.warn('⚠️ Failed to connect Storage emulator:', err);
    }
  }

  console.log('✅ Firebase Emulator setup complete');
}
