// src/testing/tests/rounds/r7_publish.test.ts
import { runRound7Publish } from "../../../../src/rounds/r7_publish";
import { httpClient } from "../../../../src/clients/http";

jest.mock("../../../../src/clients/http", () => ({
  httpClient: { request: jest.fn() },
}));

let mockFirestore: any;
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockFirestore,
}));

describe("Round7 Publish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = {
      data: [] as any[],
      collection: jest.fn().mockImplementation((name: string) => {
        if (name === "round6_coherence") {
          return {
            get: async () => ({
              docs: mockFirestore.data.map((d: any) => ({ data: () => d })),
            }),
          };
        }
        if (name === "round7_publish") {
          return {
            where: () => ({
              limit: () => ({
                get: async () => ({ empty: true }),
              }),
            }),
            add: jest.fn(),
          };
        }
      }),
    };
  });

  it("publishes a draft successfully", async () => {
    mockFirestore.data.push({
      trendId: "t1",
      validatedText: "Hello World",
      metadata: { title: "Title", description: "Desc", tags: ["tag1"] },
    });

    (httpClient.request as jest.Mock).mockImplementation((req: any) => {
      if (req.url.includes("/tags")) return { data: [{ id: 42 }] };
      if (req.method === "POST")
        return { data: { id: 123 }, status: 201 };
    });

    const res = await runRound7Publish();
    expect(res.succeeded).toBe(1);
  });

  it("logs error when WP API fails", async () => {
    mockFirestore.data.push({
      trendId: "t2",
      validatedText: "Body",
      metadata: { title: "T", description: "D", tags: [] },
    });

    (httpClient.request as jest.Mock).mockImplementation(() => {
      throw new Error("network fail");
    });

    const res = await runRound7Publish();
    expect(res.failed).toBe(1);
  });

  it("skips already published trendId", async () => {
    mockFirestore.data.push({
      trendId: "t3",
      validatedText: "B",
      metadata: { title: "T", description: "D", tags: [] },
    });

    // Force round7_publish query to return non-empty
    mockFirestore.collection = jest.fn().mockImplementation((name: string) => {
      if (name === "round6_coherence") {
        return {
          get: async () => ({
            docs: mockFirestore.data.map((d: any) => ({ data: () => d })),
          }),
        };
      }
      if (name === "round7_publish") {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({ empty: false }),
            }),
          }),
          add: jest.fn(),
        };
      }
    });

    const res = await runRound7Publish();
    expect(res.skipped).toBe(1);
  });
});
