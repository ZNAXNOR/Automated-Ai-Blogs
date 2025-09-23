/**
 * This suite tests the main function `runRound1` for:
 * - Core success case: reading trends, calling LLM, and writing ideas
 * - Schema validation of the output
 * - Handles various error conditions gracefully, including:
 *   - Artifact not found
 *   - Empty trend list
 *   - Invalid JSON from API
 *   - API error (non-200 response)
 *   - Max cap of 60 ideas enforced
 */

import { Round1_Ideate as runRound1 } from "../../../rounds/r1_ideate";
import { IdeationItem } from "../../../utils/schema";
import admin from "firebase-admin";
import fetch, { Response } from "node-fetch";

jest.mock("node-fetch", () => jest.fn());
const mockedFetch = fetch as unknown as jest.MockedFunction<typeof fetch>;

// --- Firestore Mock ---
const setMock = jest.fn();
const getMock = jest.fn();

// Forward declare mocks to handle circular dependency
let docMock: jest.Mock;
const collectionMock: jest.Mock = jest.fn((path) => ({
  doc: docMock,
  path,
}));

docMock = jest.fn((path) => ({
  get: getMock,
  set: setMock,
  collection: collectionMock, // This allows chaining .collection() after .doc()
  path,
}));

const firestoreMock = {
  collection: collectionMock,
  doc: docMock,
};

const firestoreFuncWithStatics = jest.fn(() => firestoreMock) as any;
firestoreFuncWithStatics.FieldValue = {
  serverTimestamp: jest.fn(() => "MOCK_SERVER_TIMESTAMP"),
};
// --- End Firestore Mock ---

describe("r1_ideation runRound1", () => {
  const runId = "test-run";

  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(admin, "firestore", {
      get: () => firestoreFuncWithStatics,
      configurable: true,
    });

    process.env.HUGGINGFACE_API_KEY = "test-key";
    process.env.HUGGINGFACE_MODEL = "test-model";

    // Default successful mock for round0 document
    const r0Data = {
      items: [
        { query: "AI in healthcare", type: "trending", score: 1, source: ["serp"] },
        { query: "Best budget smartphones", type: "autocomplete", score: 1, source: ["serp"] },
        { query: "Remote work productivity", type: "related", score: 1, source: ["trends"] },
      ],
      cached: false,
      sourceCounts: { serp: 2, trends: 1 },
    };
    getMock.mockResolvedValue({ exists: true, data: () => r0Data });

    // Default successful mock for fetch
    const fakeModelOutput = JSON.stringify([
      {
        trend: "AI in healthcare",
        ideas: [
          "How AI is Transforming Healthcare in 2025",
          "AI in Hospitals: Benefits and Challenges",
          "The Future of Medicine with Artificial Intelligence",
        ],
      },
      {
        trend: "Best budget smartphones",
        ideas: [
          "Top Budget Smartphones for 2025",
          "Best Value Phones Under $300",
          "Budget Phone Camera Showdown 2025",
        ],
      },
      {
        trend: "Remote work productivity",
        ideas: [
          "Remote Work Productivity: Tools That Actually Help",
          "How to Stay Focused When Working From Home",
          "Managing Teams Remotely: Productivity Best Practices",
        ],
      },
    ]);
    const mockResponse = {
      ok: true,
      status: 200,
      text: async () => fakeModelOutput,
      json: async () => JSON.parse(fakeModelOutput),
      headers: { get: () => "application/json" },
    } as unknown as Response;
    mockedFetch.mockResolvedValue(mockResponse);
  });

  test("produces valid ideation items and writes to Firestore", async () => {
    await runRound1(runId);

    expect(collectionMock).toHaveBeenCalledWith("runs");
    expect(docMock).toHaveBeenCalledWith(runId);
    expect(collectionMock).toHaveBeenCalledWith("artifacts");
    expect(docMock).toHaveBeenCalledWith("round0");

    expect(setMock).toHaveBeenCalledTimes(1);
    const [writtenData] = setMock.mock.calls[0];
    const items = writtenData.items as IdeationItem[];

    expect(items.length).toBeGreaterThanOrEqual(9);
    expect(items.length).toBeLessThanOrEqual(60);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.any(Array),
        createdAt: "MOCK_SERVER_TIMESTAMP",
      })
    );
  });

  test("throws if Round0 artifact not found", async () => {
    getMock.mockResolvedValue({ exists: false });
    await expect(runRound1(runId)).rejects.toThrow(/Round0 artifact not found/);
  });

  test("throws if no trends in artifact", async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ items: [], cached: false, sourceCounts: {} }) });
    await expect(runRound1(runId)).rejects.toThrow(/No trends found/);
  });

  test("throws on invalid JSON from API", async () => {
    const mockResponse = {
        ok: true,
        status: 200,
        text: async () => "this is not json",
        json: async () => JSON.parse("this is not json"),
        headers: { get: () => "application/json" },
      } as unknown as Response;
    mockedFetch.mockResolvedValue(mockResponse);

    await expect(runRound1(runId)).rejects.toThrow();
  });

  test("throws on API error", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "error details",
      headers: { get: () => "text/plain" },
    } as unknown as Response;
    mockedFetch.mockResolvedValue(mockResponse);

    await expect(runRound1(runId)).rejects.toThrow(/Hugging Face API error: 500/);
  });

  test("enforces max cap of 60 ideas", async () => {
    const trends = Array.from({ length: 20 }, (_, i) => ({
      query: `Trend ${i + 1}`,
      type: "trending",
      score: 1,
      source: ["test"],
    }));
    getMock.mockResolvedValue({ exists: true, data: () => ({ items: trends, cached: false, sourceCounts: {test: 20} }) });

    const fakeModelOutput = JSON.stringify(
      trends.map((t) => ({
        trend: t.query,
        ideas: Array.from({ length: 5 }, (_, i) => `Idea ${i + 1} for ${t.query}`),
      }))
    );
    const mockResponse = {
      ok: true,
      status: 200,
      text: async () => fakeModelOutput,
      json: async () => JSON.parse(fakeModelOutput),
      headers: { get: () => "application/json" },
    } as unknown as Response;
    mockedFetch.mockResolvedValue(mockResponse);

    const result = await runRound1(runId);
    expect(result.wrote).toBe(60);
  });
});
