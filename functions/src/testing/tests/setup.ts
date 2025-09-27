import * as admin from 'firebase-admin';

beforeAll(() => {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
});

afterAll(async () => {
  await Promise.all(
    admin.apps.map(app => (app ? app.delete() : Promise.resolve()))
  );
});
