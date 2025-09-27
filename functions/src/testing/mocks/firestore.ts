let firestoreState: any = {};

const get = jest.fn(async (docPath: string) => {
  const pathParts = docPath.split('/');
  let current: any = firestoreState;
  for (const part of pathParts) {
    if (!current[part]) {
      return { exists: false, data: () => undefined };
    }
    current = current[part];
  }
  return { exists: true, data: () => current };
});

const set = jest.fn(async (docPath: string, data: any) => {
  const pathParts = docPath.split('/');
  let current: any = firestoreState;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!current[part]) {
      current[part] = {};
    }
    current = current[part];
  }
  current[pathParts[pathParts.length - 1]] = data;
  return Promise.resolve();
});

const doc = jest.fn((docPath: string) => ({
  get: () => get(docPath),
  set: (data: any) => set(docPath, data),
}));

const collection = jest.fn((collectionPath: string) => ({
  doc: (docId?: string) => {
    const docPath = docId ? `${collectionPath}/${docId}` : collectionPath;
    return doc(docPath);
  },
}));



export const mockFirestore = () => {
    jest.mock('firebase-admin', () => ({
        initializeApp: jest.fn(),
        firestore: () => ({
            collection: collection,
            doc: doc,
            __reset: () => {
                firestoreState = {};
                get.mockClear();
                set.mockClear();
                doc.mockClear();
                collection.mockClear();
            }
        }),
    }));
};
