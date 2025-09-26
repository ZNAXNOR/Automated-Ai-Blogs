const R1_RUN_ID = 'test-run-123';

describe('Round 1: Ideate', () => {
  let run: any;
  let admin: any;
  let getFirestore: any;
  let mockDoc: jest.Mock;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockFirestoreInstance: any;
  let hfComplete: any;

  beforeEach(() => {
    jest.resetModules();

    const firestoreStatic = {
      FieldValue: {
        serverTimestamp: jest.fn(),
      },
    };

    jest.doMock('firebase-admin', () => ({
      apps: [],
      initializeApp: jest.fn(),
      firestore: Object.assign(jest.fn(), firestoreStatic),
    }));

    jest.doMock('firebase-admin/firestore', () => ({
      getFirestore: jest.fn(),
    }));

    jest.doMock('../../../clients/hf', () => ({
      hfComplete: jest.fn(),
    }));

    admin = require('firebase-admin');
    ({ getFirestore } = require('firebase-admin/firestore'));
    ({ hfComplete } = require('../../../clients/hf'));

    mockGet = jest.fn();
    mockSet = jest.fn();
    mockDoc = jest.fn().mockReturnValue({ get: mockGet, set: mockSet });
    mockFirestoreInstance = { doc: mockDoc };

    (getFirestore as jest.Mock).mockReturnValue(mockFirestoreInstance);
    (admin.firestore as jest.Mock).mockReturnValue(mockFirestoreInstance);

    ({ run } = require('../../../rounds/r1_ideate'));
  });

  it('should successfully generate ideas for a set of trends', async () => {
    const r0Data = {
      items: [{ query: 'AI in marketing', type: 'trending' as const, score: 80, source: ['google'] }],
      cached: false,
      sourceCounts: { google: 1 },
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r0Data });
    (hfComplete as jest.Mock).mockResolvedValue('[{"trend":"AI in marketing","ideas":["Idea 1","Idea 2","Idea 3"]}]');

    const result = await run({ runId: R1_RUN_ID });

    expect(result.wrote).toBeGreaterThan(0);
    expect(mockSet).toHaveBeenCalled();
  });

  it('should log an error if the LLM fails to generate ideas', async () => {
    const r0Data = {
      items: [{ query: 'AI in marketing', type: 'trending' as const, score: 80, source: ['google'] }],
      cached: false,
      sourceCounts: { google: 1 },
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r0Data });
    (hfComplete as jest.Mock).mockRejectedValue(new Error('LLM is down'));

    await expect(run({ runId: R1_RUN_ID })).rejects.toThrow('LLM is down');
  });
});
