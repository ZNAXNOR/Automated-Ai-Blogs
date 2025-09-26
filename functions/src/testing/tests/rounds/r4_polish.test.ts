import { run } from '../../../rounds/r4_polish';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';
import { extractJsonFromText } from '../../../clients/hf';

const RUN_ID = 'test-run-456';

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
jest.mock('../../../clients/hf');
const mockExtractJson = extractJsonFromText as jest.Mock;

describe('Round 4: Polish Draft', () => {
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

  it('should successfully polish a valid draft', async () => {
    const r3Data = {
      items: [
        {
          id: '1',
          idea: 'Test Idea',
          draft: 'This is a test draft.',
        },
      ],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r3Data });
    mockExtractJson.mockReturnValue(JSON.stringify({ polished: 'This is a polished draft that is definitely over one hundred characters long, so it should pass the validation with flying colors.', derivatives: ['tweet', 'facebook post'] }));

    const result = await run({ runId: RUN_ID });

    expect(result.polishedCount).toBe(1);
    expect(result.failures).toBe(0);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('should move a draft to failures if it cannot be refined', async () => {
    const r3Data = {
      items: [
        {
          id: '1',
          idea: 'Test Idea',
          draft: 'This draft cannot be refined.',
        },
      ],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r3Data });
    mockExtractJson.mockImplementation(() => { throw new Error('Refinement error'); });

    const result = await run({ runId: RUN_ID });

    expect(result.polishedCount).toBe(0);
    expect(result.failures).toBe(1);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('should handle no items in the R3 artifact', async () => {
    const r3Data = { items: [] };
    mockGet.mockResolvedValue({ exists: true, data: () => r3Data });

    await expect(run({ runId: RUN_ID })).rejects.toThrow('R3 artifact has no items.');
  });
});
