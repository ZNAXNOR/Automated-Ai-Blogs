// src/testing/tests/rounds/r7_publish.test.ts
import { run } from "../../../../src/rounds/r7_publish";
import { httpClient } from "../../../../src/clients/http";
import { Timestamp } from "firebase-admin/firestore";

jest.mock("../../../../src/clients/http", () => ({
  httpClient: { request: jest.fn() },
}));

let mockFirestore: any;
let mockBatch: any;

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockFirestore,
  Timestamp: {
    now: () => ({
      toDate: () => new Date(),
    }),
  },
}));

describe("Round7 Publish", () => {
  const runId = "test-run";

  beforeEach(() => {
    jest.clearAllMocks();

    mockBatch = {
      set: jest.fn(),
      commit: jest.fn(),
    };

    mockFirestore = {
      r6data: [] as any[],
      r7data: [] as any[],
      batch: () => mockBatch,
      collection: jest.fn().mockImplementation((name: string) => {
        if (name === `runs/${runId}/artifacts/round6`) {
          return {
            get: async () => ({
              docs: mockFirestore.r6data.map((d: any) => ({ data: () => d })),
            }),
          };
        }
        if (name === `runs/${runId}/artifacts/round7`) {
          return {
            get: async () => ({
                docs: mockFirestore.r7data.map((d: any) => ({ data: () => d })),
            }),
            doc: jest.fn(() => ({})), // Mock doc() to return a dummy object
          };
        }
        return {};
      }),
    };
  });

  it("publishes a draft successfully", async () => {
    mockFirestore.r6data.push({
      trendId: "t1",
      validatedText: "Hello World",
      metadata: { title: "Title", description: "Desc", tags: ["tag1"] },
    });

    (httpClient.request as jest.Mock).mockImplementation((req: any) => {
      if (req.url.includes("/tags")) return { data: [{ id: 42 }] };
      if (req.method === "POST")
        return { data: { id: 123 }, status: 201 };
    });

    const res = await run({ runId });

    expect(res.succeeded).toBe(1);
    expect(res.processed).toBe(1);
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    const call = mockBatch.set.mock.calls[0];
    expect(call[1]).toMatchObject({
        status: 'draft',
        wpPostId: 123
    });
  });

  it("logs error when WP API fails", async () => {
    mockFirestore.r6data.push({
      trendId: "t2",
      validatedText: "Body",
      metadata: { title: "T", description: "D", tags: [] },
    });

    (httpClient.request as jest.Mock).mockImplementation(() => {
      throw new Error("network fail");
    });

    const res = await run({ runId });
    expect(res.failed).toBe(1);
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    const call = mockBatch.set.mock.calls[0];
    expect(call[1]).toMatchObject({
        status: 'error',
        errorMessage: 'network fail'
    });
  });

  it("skips already published trendId", async () => {
    mockFirestore.r6data.push({
      trendId: "t3",
      validatedText: "B",
      metadata: { title: "T", description: "D", tags: [] },
    });
    mockFirestore.r7data.push({ trendId: "t3" }); // This trendId already exists in round7

    const res = await run({ runId });
    expect(res.skipped).toBe(1);
    expect(res.processed).toBe(1);
    expect(mockBatch.set).not.toHaveBeenCalled();
  });

  it("fails validation for missing title", async () => {
    mockFirestore.r6data.push({
        trendId: "t4",
        validatedText: "Body",
        metadata: { description: "D", tags: [] },
    });

    const res = await run({ runId });
    expect(res.failed).toBe(1);
    expect(res.succeeded).toBe(0);
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    const call = mockBatch.set.mock.calls[0];
    expect(call[1]).toMatchObject({
        status: 'error',
        errorMessage: 'Missing title or content'
    });
  });

  it("handles non-201 response from WP as failure", async () => {
    mockFirestore.r6data.push({
        trendId: "t5",
        validatedText: "Body",
        metadata: { title: "T", description: "D", tags: [] },
    });

    (httpClient.request as jest.Mock).mockResolvedValue({ status: 500, data: { message: "Internal Server Error" } });

    const res = await run({ runId });
    expect(res.failed).toBe(1);
    expect(res.succeeded).toBe(0);
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    const call = mockBatch.set.mock.calls[0];
    expect(call[1].status).toBe('error');
    expect(call[1].errorMessage).toContain('Failed to create post in WordPress');
  });
});