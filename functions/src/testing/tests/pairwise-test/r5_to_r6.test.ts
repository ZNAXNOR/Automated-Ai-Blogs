import { run as runR6 } from '../../../rounds/r6_coherence';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';
import * as hf from '../../../clients/hf';

const RUN_ID = 'pairwise-test-r5-r6';

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
const mockHfSentenceSimilarity = hf.hfSentenceSimilarity as jest.Mock;

describe('R5 to R6 Pairwise Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    admin.apps.length = 0; // Reset apps before each test
  });

  it('should run R6 successfully with the output from R5', async () => {
    const r5Data = {
      items: [
        { id: '1', title: 'AI in Marketing', draft: 'This is a draft.', metaTitle: 'AI Marketing', metaDescription: 'Desc' },
        { id: '2', title: 'Sustainable Living', draft: 'This is a draft.', metaTitle: 'Sustainable Living', metaDescription: 'Desc' },
      ],
    };

    const mockGet = jest.fn().mockResolvedVaxlue({ exists: true, data: () => r5Data });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    const mockBatchSet = jest.fn();
    const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
    const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

    (admin.firestore as jest.Mock).mockReturnValue({
        doc: mockDoc,
        batch: mockBatch,
    });

    mockHfSentenceSimilarity.mockResolvedValue([0.8, 0.9]);

    const result = await runR6({ runId: RUN_ID });

    expect(mockDoc).toHaveBeenCalledWith(constants.ARTIFACT_PATHS.R5_META.replace('{runId}', RUN_ID));
    expect(result.passed).toBe(r5Data.items.length);
    expect(result.failed).toBe(0);
  }, 10000);
});
