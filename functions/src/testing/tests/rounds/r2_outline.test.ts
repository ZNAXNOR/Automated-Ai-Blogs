const R2_RUN_ID = 'test-run-123';

describe('Round 2: Outline', () => {
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

    ({ run } = require('../../../rounds/r2_outline'));
  });

  it('should successfully generate outlines for each idea', async () => {
    const r1Data = {
      items: [
        { idea: 'Personalized learning paths using AI', trend: 'Personalized learning', variant: 1, source: 'llm' as const },
        { idea: 'Gamified fitness apps for remote workers', trend: 'Gamified fitness', variant: 1, source: 'llm' as const },
      ],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r1Data });

    const llmResponse = `
    [      
      {
        "trend": "Personalized learning",
        "idea": "Personalized learning paths using AI",
        "sections": [
          {
            "heading": "Introduction",
            "bullets": ["Overview of AI in education"],
            "estWordCount": 100
          }
        ]
      },
      {
        "trend": "Gamified fitness",
        "idea": "Gamified fitness apps for remote workers",
        "sections": [
          {
            "heading": "Introduction",
            "bullets": ["The rise of remote work and home fitness"],
            "estWordCount": 100
          }
        ]
      }
    ]
    `;
    (hfComplete as jest.Mock).mockResolvedValue(llmResponse);

    const result = await run({ runId: R2_RUN_ID });

    expect(result.wrote).toBe(r1Data.items.length);
    expect(mockSet).toHaveBeenCalled();
  });

  it('should throw an error if the LLM response is invalid', async () => {
    const r1Data = {
      items: [
        { idea: 'AI in marketing', trend: 'AI in marketing', variant: 1, source: 'llm' as const }
      ]
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r1Data });
    (hfComplete as jest.Mock).mockResolvedValue('invalid json');

    await expect(run({ runId: R2_RUN_ID })).rejects.toThrow();
  });
});
