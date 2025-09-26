import { run as runR7 } from '../../../rounds/r7_publish';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';

const RUN_ID = 'pairwise-test-r6-r7';

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => {
  const mockFirestore = () => ({
    doc: jest.fn(),
    collection: jest.fn(),
    batch: jest.fn(() => ({ set: jest.fn(), commit: jest.fn() }))
  });
  const firebaseAdmin = {
    initializeApp: jest.fn(),
    firestore: mockFirestore,
    apps: [] as any[],
  };
  (firebaseAdmin.initializeApp as jest.Mock).mockImplementation(() => {
    if (firebaseAdmin.apps.length === 0) {
      firebaseAdmin.apps.push({ name: '[DEFAULT]' });
    }
  });
  return firebaseAdmin;
});

describe('R6 to R7 Pairwise Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    admin.apps.length = 0; // Reset apps before each test
  });

  it('should run R7 successfully with the output from R6', async () => {
    const r6Data = {
      passed: [
        { id: '1', title: 'Test Title', draft: 'This is a coherent draft.' },
      ],
      failed: [],
    };

    const mockGet = jest.fn().mockResolvedValue({ exists: true, data: () => r6Data });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    const mockBatchSet = jest.fn();
    const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
    const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

    (admin.firestore as jest.Mock).mockReturnValue({
        doc: mockDoc,
        batch: mockBatch,
        collection: jest.fn().mockReturnValue({ doc: jest.fn() })
    });

    const result = await runR7({ runId: RUN_ID });

    expect(mockDoc).toHaveBeenCalledWith(constants.ARTIFACT_PATHS.R6_COHERENCE.replace('{runId}', RUN_ID));
    expect(result.succeeded).toBe(r6Data.passed.length);
    expect(result.failed).toBe(r6Data.failed.length);
  }, 10000);
});
