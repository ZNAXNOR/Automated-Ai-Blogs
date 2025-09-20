/**
 * Pairwise Chain Test: R0 → R1
 *
 * Ensures that the output of Round0 (trend normalization/deduplication)
 * can be directly consumed by Round1 (ideation) without schema mismatch
 * or invalid data breaking the pipeline.
 */

import { _test as R0 } from "../../../rounds/r0_trends";
import { Round1_Ideate as runRound1, IdeationItem } from "../../../rounds/r1_ideate";
import admin from "firebase-admin";
import fetch, { Response } from "node-fetch";

jest.mock("node-fetch", () => jest.fn());
const mockedFetch = fetch as unknown as jest.MockedFunction<typeof fetch>;

// --- Firestore Mock (same as r1.test.ts) ---
const setMock = jest.fn();
const getMock = jest.fn();
const docMock: jest.Mock = jest.fn();
const collectionMock: jest.Mock = jest.fn(() => ({ doc: docMock }));
docMock.mockImplementation(() => ({
  get: getMock,
  set: setMock,
  collection: collectionMock,
}));

const firestoreMock = {
  collection: collectionMock,
};

const firestoreFuncWithStatics = jest.fn(() => firestoreMock) as any;
firestoreFuncWithStatics.FieldValue = {
  serverTimestamp: jest.fn(() => "MOCK_SERVER_TIMESTAMP"),
};
// --- End Firestore Mock ---

describe("Pairwise: R0 -> R1", () => {
  const runId = "pairwise-test-run";

  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(admin, "firestore", {
      get: () => firestoreFuncWithStatics,
      configurable: true,
    });

    process.env.HUGGINGFACE_API_KEY = "test-key";
    process.env.HUGGINGFACE_MODEL = "test-model";
  });

  test("R0 output feeds correctly into R1 ideation", async () => {
    // Step 1: Run R0 deterministically
    const buckets = [
      {
        type: "autocomplete" as const,
        sourceName: "serp:autocomplete",
        items: [
          "Apple iPhone 16 launch date?",
          "OpenAI o3 mini",
          "Remote work productivity",
        ],
      },
      {
        type: "rss" as const,
        sourceName: "rss:theverge",
        items: ["AI in healthcare"],
      },
    ];
    const { items: r0Trends } = R0.deterministicProcess(buckets);

    // Step 2: Mock Firestore get to return R0 trends
    getMock.mockResolvedValue({ exists: true, data: () => ({ trends: r0Trends }) });

    // Step 3: Mock LLM API for R1
    const fakeModelOutput = JSON.stringify(
      r0Trends.map((t) => ({
        trend: t.query,
        ideas: [
          `Blog idea 1 for ${t.query}`,
          `Blog idea 2 for ${t.query}`,
          `Blog idea 3 for ${t.query}`,
        ],
      }))
    );
    const mockResponse = {
      ok: true,
      status: 200,
      text: async () => fakeModelOutput,
      headers: { get: () => "application/json" },
    } as unknown as Response;
    mockedFetch.mockResolvedValue(mockResponse);

    // Step 4: Run R1 using R0's output
    await runRound1(runId);

    // Step 5: Assertions
    expect(setMock).toHaveBeenCalledTimes(1);
    const [writtenData] = setMock.mock.calls[0];
    const items = writtenData.items as IdeationItem[];

    // Schema checks
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.trend).toEqual(expect.any(String));
      expect(item.idea).toEqual(expect.any(String));
      expect(item.idea.trim().length).toBeGreaterThan(0);
    }
  }, 10000);
});
