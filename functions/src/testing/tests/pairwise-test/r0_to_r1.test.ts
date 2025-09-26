import { run as runR1 } from '../../../rounds/r1_ideate';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';
import * as hf from '../../../clients/hf';

const RUN_ID = 'pairwise-test-r0-r1';

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => {
  const mockFirestore = () => ({
    doc: jest.fn(),
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

describe('R0 to R1 Pairwise Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    admin.apps.length = 0; // Reset apps before each test
  });

  it('should run R1 successfully with the output from R0', async () => {
    const r0Data = {
      items: [{ query: 'AI in marketing', source: ['test'] }],
      cached: false,
      sourceCounts: { google: 1 },
    };

    const mockGet = jest.fn().mockResolvedValue({ exists: true, data: () => r0Data });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet, set: jest.fn() });
    (admin.firestore as jest.Mock).mockReturnValue({ doc: mockDoc });

    mockHfComplete.mockResolvedValue('1. Idea 1\n2. Idea 2');

    const result = await runR1({ runId: RUN_ID });

    expect(mockDoc).toHaveBeenCalledWith(constants.ARTIFACT_PATHS.R0_TRENDS.replace('{runId}', RUN_ID));
    expect(result.wrote).toBeGreaterThan(0);
  }, 10000);
});
