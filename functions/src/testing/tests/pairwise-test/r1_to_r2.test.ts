import { run as runR2 } from '../../../rounds/r2_outline';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';
import * as llm from '../../../clients/llm';

const RUN_ID = 'pairwise-test-r1-r2';

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => {
    const mockFirestore = () => ({
        doc: jest.fn(),
        collection: jest.fn(),
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

// Mock LLM client
jest.mock('../../../clients/llm');
const mockLlm = llm.llm as jest.Mock;

describe('R1 to R2 Pairwise Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    admin.apps.length = 0; // Reset apps before each test
  });

  it('should run R2 successfully with the output from R1', async () => {
    const r1Data = {
      items: [
        { idea: 'Personalized learning paths using AI', trend: 'AI in education', variant: 1, source: 'llm' as const },
        { idea: 'Gamified fitness apps for remote workers', trend: 'Home fitness', variant: 1, source: 'llm' as const },
      ],
    };

    const mockGet = jest.fn().mockResolvedValue({ exists: true, data: () => r1Data });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet, set: jest.fn() });
    const mockCollection = jest.fn(() => ({ doc: mockDoc }));
    (admin.firestore as jest.Mock).mockReturnValue({ doc: mockDoc, collection: mockCollection });

    mockLlm.mockResolvedValue('## Section 1\n- Point A');

    const result = await runR2({ runId: RUN_ID });

    expect(mockDoc).toHaveBeenCalledWith(constants.ARTIFACT_PATHS.R1_IDEAS.replace('{runId}', RUN_ID));
    expect(result.wrote).toBe(r1Data.items.length);
  }, 10000);
});
