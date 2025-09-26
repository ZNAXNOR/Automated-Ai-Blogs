const R7_RUN_ID = 'test-run-789';

describe('Round 7: Publish to WordPress', () => {
  let run: any;
  let admin: any;
  let getFirestore: any;
  let mockCollection: jest.Mock;
  let mockWhere: jest.Mock;
  let mockGet: jest.Mock;
  let mockBatch: jest.Mock;
  let mockSet: jest.Mock;
  let mockCommit: jest.Mock;
  let mockFirestoreInstance: any;
  let httpClient: any;
  let mockDoc: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    jest.doMock('firebase-admin', () => ({
      apps: [],
      initializeApp: jest.fn(),
      firestore: jest.fn(),
    }));
    jest.doMock('firebase-admin/firestore', () => ({
      getFirestore: jest.fn(),
      Timestamp: {
        now: jest.fn(() => ({ toDate: () => new Date() })),
      },
    }));
    jest.doMock('../../../clients/http', () => ({
      httpClient: {
        request: jest.fn(),
      },
    }));

    admin = require('firebase-admin');
    ({ getFirestore } = require('firebase-admin/firestore'));
    httpClient = require('../../../clients/http').httpClient;

    mockGet = jest.fn();
    mockWhere = jest.fn().mockReturnValue({ get: mockGet });
    mockSet = jest.fn();
    mockCommit = jest.fn().mockResolvedValue(undefined);
    mockBatch = jest.fn().mockReturnValue({ set: mockSet, commit: mockCommit });
    mockDoc = jest.fn().mockReturnValue({ id: 'new-doc-id' });
    mockCollection = jest.fn().mockReturnValue({ where: mockWhere, get: mockGet, doc: mockDoc });

    mockFirestoreInstance = {
      collection: mockCollection,
      batch: mockBatch,
    };

    (getFirestore as jest.Mock).mockReturnValue(mockFirestoreInstance);
    (admin.firestore as jest.Mock).mockReturnValue(mockFirestoreInstance);

    ({ run } = require('../../../rounds/r7_publish'));
  });

  it('should successfully publish an article', async () => {
    const r6Data = {
      docs: [
        {
          data: () => ({
            id: '1',
            validatedText: 'This is a test draft.',
            metadata: { title: 'Test Title', description: 'Test Desc', tags: ['tag1'] },
            trendId: 'trend1',
          }),
        },
      ],
    };
    mockGet.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce(r6Data);

    (httpClient.request as jest.Mock).mockImplementation((config: any) => {
      if (config.url.includes('/tags?search=tag1')) {
        return Promise.resolve({ status: 200, data: [{ id: 123, name: 'tag1' }] });
      }
      if (config.url.includes('/posts')) {
        return Promise.resolve({ status: 201, data: { id: 456, url: 'http://test-url.com' } });
      }
      return Promise.reject(new Error(`Unhandled request: ${config.url}`));
    });

    const result = await run({ runId: R7_RUN_ID });

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockCommit).toHaveBeenCalled();
  });

  it('should handle articles with missing data', async () => {
    const r6Data = {
      docs: [
        {
          data: () => ({
            id: '2',
            validatedText: null,
            metadata: { title: 'Incoherent Title', description: 'Incoherent Desc', tags: ['tag2'] },
            trendId: 'trend2',
          }),
        },
      ],
    };
    mockGet.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce(r6Data);

    const result = await run({ runId: R7_RUN_ID });

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(mockCommit).toHaveBeenCalled();
  });
});
