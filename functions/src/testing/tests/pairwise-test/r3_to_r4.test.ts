import { run as runR4 } from '../../../rounds/r4_polish';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';
import * as hf from '../../../clients/hf';

const RUN_ID = 'pairwise-test-r3-r4';

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

describe('R3 to R4 Pairwise Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    admin.apps.length = 0; // Reset apps before each test
  });

  it('should run R4 successfully with the output from R3', async () => {
    const r3Data = {
      items: [
        { id: '1', idea: 'AI in marketing', draft: 'This is a draft about AI in marketing.' },
        { id: '2', idea: 'Sustainable living tips', draft: 'This is a draft about sustainable living.' },
      ],
    };

    const mockGet = jest.fn().mockResolvedValue({ exists: true, data: () => r3Data });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    const mockBatchSet = jest.fn();
    const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
    const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

    (admin.firestore as jest.Mock).mockReturnValue({
        doc: mockDoc,
        batch: mockBatch,
    });

    mockHfComplete.mockResolvedValue('{ "polished": "This is a polished draft." }');
    mockExtractJson.mockReturnValue({ polished: 'This is a polished draft.' });

    const result = await runR4({ runId: RUN_ID });

    expect(mockDoc).toHaveBeenCalledWith(constants.ARTIFACT_PATHS.R3_DRAFTS.replace('{runId}', RUN_ID));
    expect(result.polishedCount).toBe(r3Data.items.length);
    expect(result.failures).toBe(0);
  }, 10000);
});
