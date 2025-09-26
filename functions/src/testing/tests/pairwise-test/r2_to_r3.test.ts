import { run as runR3 } from '../../../rounds/r3_draft';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';
import * as hf from '../../../clients/hf';

const RUN_ID = 'pairwise-test-r2-r3';

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

// Mock HF client
jest.mock('../../../clients/hf');
const mockHfComplete = hf.hfComplete as jest.Mock;

describe('R2 to R3 Pairwise Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    admin.apps.length = 0; // Reset apps before each test
  });

  it('should run R3 successfully with the output from R2', async () => {
    const r2Data = {
      items: [
        { id: '1', idea: 'Personalized learning paths using AI', outline: '## Introduction\n- AI in Education' },
      ],
    };

    const mockGet = jest.fn().mockResolvedValue({ exists: true, data: () => r2Data });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    const mockBatchSet = jest.fn();
    const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
    const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

    (admin.firestore as jest.Mock).mockReturnValue({
        doc: mockDoc,
        batch: mockBatch,
    });

    mockHfComplete.mockResolvedValue('This is a generated draft.');

    const result = await runR3({ runId: RUN_ID });

    // Assertions
    expect(mockDoc).toHaveBeenCalledWith(constants.ARTIFACT_PATHS.R2_OUTLINES.replace('{runId}', RUN_ID));
    expect(result.draftsCreated).toBe(r2Data.items.length);
    expect(result.failures).toBe(0);
  });
});
