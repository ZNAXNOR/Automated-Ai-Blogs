
import { mockFirestore } from './firestore';

export const mockFirebase = () => {
  mockFirestore();
};

export const resetFirebase = () => {
  require('firebase-admin').firestore().__reset();
};
