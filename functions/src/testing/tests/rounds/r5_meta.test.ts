import { run } from '../../../rounds/r5_meta';
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

describe('Round 5: Metadata Generation', () => {
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

  it('should generate metadata for a polished draft', async () => {
    const r4Data = {
      items: [
        {
          id: '1',
          idea: 'Test Idea',
          polishedDraft: 'This is a polished test draft that is long enough to pass validation, which is good. This is a polished test draft that is long enough to pass validation, which is good. This is a polished test draft that is long enough to pass validation, which is good.',
          trendId: 'trend-1',
        },
      ],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r4Data });
    mockExtractJson.mockReturnValue(JSON.stringify({ 
      seoTitle: 'SEO Title', 
      metaDescription: 'Meta Description', 
      tags: ['tag1', 'tag2', 'tag3'], 
      categories: ['cat1', 'cat2'], 
      excerpt: 'This is an excerpt that is between 50 and 100 words. This is an excerpt that is between 50 and 100 words. This is an excerpt that is between 50 and 100 words. This is an excerpt that is between 50 and 100 words. This is an excerpt that is between 50 and 100 words.', 
      relatedKeywords: ['keyword1', 'keyword2', 'keyword3'], 
      imageSuggestions: ['image1', 'image2'] 
    }));

    const result = await run({ runId: RUN_ID });

    expect(result.metaCount).toBe(1);
    expect(result.failures).toBe(0);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('should handle LLM failures during metadata generation', async () => {
    const r4Data = {
      items: [
        {
          id: '1',
          idea: 'Test Idea',
          polishedDraft: 'This is a polished test draft that is long enough to pass validation, which is good. This is a polished test draft that is long enough to pass validation, which is good. This is a polished test draft that is long enough to pass validation, which is good.',
          trendId: 'trend-1',
        },
      ],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r4Data });
    mockExtractJson.mockImplementation(() => { throw new Error('LLM error'); });

    const result = await run({ runId: RUN_ID });

    expect(result.metaCount).toBe(0);
    expect(result.failures).toBe(1);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('should throw an error for short drafts', async () => {
    const r4Data = {
      items: [
        {
          id: '1',
          idea: 'Test Idea',
          polishedDraft: 'Too short.',
          trendId: 'trend-1',
        },
      ],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r4Data });

    const result = await run({ runId: RUN_ID });
    expect(result.failures).toBe(1);
  });
});
