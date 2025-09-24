import { run } from "../../../rounds/r7_publish";
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { httpClient } from "../../../clients/http";

// --- Mocks Setup ---

// Mock the entire firestore service
jest.mock('firebase-admin/firestore', () => {
    const collectionMock = jest.fn();
    const docMock = jest.fn();
    const batchSetMock = jest.fn();
    const batchCommitMock = jest.fn().mockResolvedValue(null);
    const batchMock = { set: batchSetMock, commit: batchCommitMock };
    const firestoreMock = {
        collection: collectionMock,
        batch: () => batchMock,
        __mocks: { collection: collectionMock, doc: docMock, batch: { set: batchSetMock, commit: batchCommitMock } }
    };
    return { getFirestore: () => firestoreMock, Timestamp: { now: () => ({ toDate: () => new Date() }) } };
});

// Mock the HTTP client to prevent real network calls
jest.mock('../../../clients/http');

const mockedHttpClient = httpClient as jest.Mocked<typeof httpClient>;
const dbMocks = (getFirestore() as any).__mocks;

// --- Test Data ---
const round6Items = [
  {
    trendId: "t1",
    validatedText: "This is the first article body.",
    metadata: { title: "Title 1", description: "Excerpt 1", tags: ["tech", "ai"] }
  },
  {
    trendId: "t2",
    validatedText: "This is the second article body.",
    metadata: { title: "Title 2", description: "Excerpt 2", tags: ["health"] }
  },
];

// --- Test Suite ---
describe("Round 7: Publish", () => {
  const runId = "test-run-123";
  let r7NewDocRefMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Firestore Mocks ---
    r7NewDocRefMock = { id: "new-doc-id" };
    const r7CollectionRef = {
        get: jest.fn().mockResolvedValue({ docs: [] }), // No existing published items
        doc: jest.fn().mockReturnValue(r7NewDocRefMock), // Return a ref for new docs
    };
    const r6Docs = round6Items.map(item => ({ id: item.trendId, data: () => item }));
    const r6CollectionRef = { get: jest.fn().mockResolvedValue({ docs: r6Docs }) };

    dbMocks.collection.mockImplementation((path: string) => {
        if (path.endsWith('round7')) return r7CollectionRef;
        if (path.endsWith('round6')) return r6CollectionRef;
    });

    // --- HTTP Client Mocks ---
    mockedHttpClient.request.mockImplementation(async (config: any) => {
        // Mock for WordPress tag resolution
        if (config.url.includes('/tags')) {
            return { data: [{ id: 123, name: config.url.split("=")[1] }] };
        }
        // Mock for WordPress post creation
        if (config.url.includes('/posts')) {
            return { status: 201, data: { id: 456, link: "http://example.com/post/456" } };
        }
        return { status: 200, data: {} };
    });
  });

  test("should process and publish all valid items from Round 6", async () => {
    // --- Act ---
    const result = await run({ runId });

    // --- Assert ---
    // 1. Check final result counts
    expect(result).toEqual({ processed: 2, skipped: 0, succeeded: 2, failed: 0 });

    // 2. Check Firestore collection reads
    expect(dbMocks.collection).toHaveBeenCalledWith(`runs/${runId}/artifacts/round7`);
    expect(dbMocks.collection).toHaveBeenCalledWith(`runs/${runId}/artifacts/round6`);

    // 3. Check HTTP calls for tag resolution and post creation
    expect(mockedHttpClient.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("/tags") }));
    expect(mockedHttpClient.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("/posts") }));

    // 4. Check batched writes
    expect(dbMocks.batch.set).toHaveBeenCalledTimes(2);
    expect(dbMocks.batch.commit).toHaveBeenCalledTimes(1);

    // 5. Deep inspection of the first batched write
    const firstBatchCallArgs = dbMocks.batch.set.mock.calls[0];
    const docRef = firstBatchCallArgs[0];
    const payload = firstBatchCallArgs[1];

    expect(docRef).toBe(r7NewDocRefMock); // Check that we used the newly generated doc ref
    expect(payload).toHaveProperty("trendId", round6Items[0].trendId);
    expect(payload).toHaveProperty("status", "draft");
    expect(payload).toHaveProperty("wpPostId", 456);
  });
});
