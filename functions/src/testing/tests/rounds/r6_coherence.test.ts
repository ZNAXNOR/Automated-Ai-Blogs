import { run } from '../../../rounds/r6_coherence';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';
import { calculateSimilarity } from '../../../clients/hf_sentence';

const RUN_ID = 'test-run-789';

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => {
  const firestoreMock = {
    doc: jest.fn(),
    batch: jest.fn(() => ({ set: jest.fn(), commit: jest.fn() })),
  };

  const mockAdmin = {
    initializeApp: jest.fn(),
    firestore: Object.assign(jest.fn(() => firestoreMock), {
      FieldValue: { serverTimestamp: jest.fn() },
    }),
    apps: [] as any[],
  };

  (mockAdmin.initializeApp as jest.Mock).mockImplementation(() => {
    if (mockAdmin.apps.length === 0) {
        mockAdmin.apps.push({ name: '[DEFAULT]' });
    }
  });

  return mockAdmin;
});

// Mock HF client
jest.mock('../../../clients/hf_sentence');
const mockCalculateSimilarity = calculateSimilarity as jest.Mock;

describe('Round 6: Coherence Check', () => {
  let mockDoc: jest.Mock, mockGet: jest.Mock;
  let mockBatchSet: jest.Mock, mockBatchCommit: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    admin.apps.length = 0;

    mockGet = jest.fn();
    mockDoc = jest.fn(() => ({ get: mockGet }));
    mockBatchSet = jest.fn();
    mockBatchCommit = jest.fn().mockResolvedValue(undefined);

    (admin.firestore().doc as jest.Mock).mockImplementation(mockDoc);
    (admin.firestore().batch as jest.Mock).mockImplementation(() => ({ set: mockBatchSet, commit: mockBatchCommit }));
  });

  it('should successfully pass a coherent article', async () => {
    const r5Data = {
      items: [
        {
          id: '1',
          title: 'Test Title',
          draft: 'This is a sentence. This is another sentence.',
          metaTitle: 'Meta Title',
          metaDescription: 'Meta Description',
          trendId: 'trend-1',
        },
      ],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r5Data });
    mockCalculateSimilarity.mockResolvedValue([0.9, 0.8]);

    const result = await run({ runId: RUN_ID });

    expect(result.coherenceCount).toBe(1);
    expect(result.failures).toBe(0);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('should handle sentence similarity failures', async () => {
    const r5Data = {
      items: [
        {
          id: '1',
          title: 'Test Title',
          draft: 'This is a sentence. This is another sentence.',
          metaTitle: 'Meta Title',
          metaDescription: 'Meta Description',
          trendId: 'trend-1',
        },
      ],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r5Data });
    mockCalculateSimilarity.mockRejectedValue(new Error('HF is down'));

    const result = await run({ runId: RUN_ID });

    expect(result.coherenceCount).toBe(0);
    expect(result.failures).toBe(1);
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});
