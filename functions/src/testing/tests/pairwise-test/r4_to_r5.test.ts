import { run as runR5 } from '../../../rounds/r5_meta';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';
import * as hf from '../../../clients/hf';

const RUN_ID = 'pairwise-test-r4-r5';

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
const mockExtractJson = hf.extractJsonFromText as jest.Mock;

describe('R4 to R5 Pairwise Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    admin.apps.length = 0; // Reset apps before each test
  });

  it('should run R5 successfully with the output from R4', async () => {
    const r4Data = {
      items: [
        { id: '1', idea: 'AI in Marketing', polishedDraft: 'This is a polished draft about AI in marketing.' },
        { id: '2', idea: 'Sustainable living tips', polishedDraft: 'This is a polished draft about sustainable living.' },
      ],
    };

    const mockGet = jest.fn().mockResolvedValue({ exists: true, data: () => r4Data });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    const mockBatchSet = jest.fn();
    const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
    const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

    (admin.firestore as jest.Mock).mockReturnValue({
        doc: mockDoc,
        batch: mockBatch,
    });

    mockExtractJson.mockReturnValue({ seoTitle: 'SEO Title', seoDescription: 'SEO Description' });

    const result = await runR5({ runId: RUN_ID });

    expect(mockDoc).toHaveBeenCalledWith(constants.ARTIFACT_PATHS.R4_POLISHED.replace('{runId}', RUN_ID));
    expect(result.metaCount).toBe(r4Data.items.length);
    expect(result.failures).toBe(0);
  }, 10000);
});
