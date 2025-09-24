const mockSet = jest.fn();
const mockGet = jest.fn();
// Add path to the mock doc so we can identify it in tests
const mockDoc = jest.fn((path) => ({ get: mockGet, set: mockSet, path }));
const mockBatchCommit = jest.fn();
const mockBatchSet = jest.fn();
const mockBatch = jest.fn(() => ({
  commit: mockBatchCommit,
  set: mockBatchSet,
  get isEmpty() {
    return mockBatchSet.mock.calls.length === 0;
  },
}));

jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    () => ({
      doc: mockDoc,
      batch: mockBatch,
    }),
    {
      FieldValue: {
        serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP"),
      },
    }
  ),
}));

// Manually mock the hf client to ensure all exports are present
jest.mock("../../../clients/hf", () => ({
  __esModule: true,
  hfComplete: jest.fn(),
  extractJsonFromText: jest.fn(),
}));

import { _test as Round4_Polish } from "../../../rounds/r4_polish";
import * as hf from "../../../clients/hf";
import { HttpsError } from "firebase-functions/v2/https";
import { ARTIFACT_PATHS } from "../../../utils/constants";

const mockHfComplete = hf.hfComplete as jest.Mock;
const mockExtractJson = hf.extractJsonFromText as jest.Mock;

const RUN_ID = "test-run-789";

const MOCK_R3_DATA = {
  items: [
    {
      idea: "The Future of Remote Work",
      draft: "Draft about remote work...",
    },
    {
      idea: "The History of Coffee",
      draft: "Draft about coffee...",
    },
  ],
};

const VALID_LLM_OUTPUT = {
  polished: "This is a beautifully polished piece of content about remote work. It is well-structured, engaging, and provides valuable insights for the reader. ".repeat(5),
  derivatives: [
    "Check out our new blog post on the future of remote work! #remotework #futureofwork",
    "Are you ready for the new era of work? Our latest article explores the trends and challenges of remote work.",
  ],
};

const MALFORMED_LLM_OUTPUT_STRING = `Here's the content you requested... {\"polished\": \"...\"}`;

describe("runR4_Polish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true, data: () => MOCK_R3_DATA });
    // The function being mocked is synchronous, so we just return the input text
    mockExtractJson.mockImplementation((text) => text);
  });

  it("should process all drafts successfully, writing a single polished artifact", async () => {
    mockHfComplete.mockResolvedValue(JSON.stringify(VALID_LLM_OUTPUT));

    const result = await Round4_Polish.runR4_Polish(RUN_ID);

    expect(result).toEqual({ polishedCount: 2, failures: 0 });
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockHfComplete).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).toHaveBeenCalledTimes(1); // Only one successful artifact
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);

    const successPath = ARTIFACT_PATHS.R4_POLISHED_DRAFT.replace("{runId}", RUN_ID);
    const writtenRef = mockBatchSet.mock.calls[0][0];
    const writtenData = mockBatchSet.mock.calls[0][1];

    expect(writtenRef.path).toBe(successPath);
    expect(writtenData.items).toHaveLength(2);
    expect(writtenData.items[0].idea).toBe("The Future of Remote Work");
    expect(writtenData.items[0].derivatives).toHaveLength(2);
  });

  it("should handle a mix of successful and failed polishing attempts", async () => {
    mockHfComplete
      .mockResolvedValueOnce(JSON.stringify(VALID_LLM_OUTPUT)) // 1st item succeeds
      .mockRejectedValueOnce(new Error("LLM is flaky"))       // 2nd item fails once
      .mockRejectedValueOnce(new Error("LLM is still flaky")); // 2nd item fails retry

    const result = await Round4_Polish.runR4_Polish(RUN_ID);

    expect(result).toEqual({ polishedCount: 1, failures: 1 });
    expect(mockBatchSet).toHaveBeenCalledTimes(2); // One success, one failure
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);

    const successPath = ARTIFACT_PATHS.R4_POLISHED_DRAFT.replace("{runId}", RUN_ID);
    const successCall = mockBatchSet.mock.calls.find(call => call[0].path === successPath);
    expect(successCall[1].items).toHaveLength(1);
    expect(successCall[1].items[0].idea).toBe("The Future of Remote Work");

    const failurePath = ARTIFACT_PATHS.R4_FAILURES.replace("{runId}", RUN_ID);
    const failureCall = mockBatchSet.mock.calls.find(call => call[0].path === failurePath);
    expect(failureCall[1].items).toHaveLength(1);
    expect(failureCall[1].items[0].item.idea).toBe("The History of Coffee");
    expect(failureCall[1].items[0].error).toContain("LLM is still flaky");
  });

  it("should retry on malformed JSON and succeed on the second attempt", async () => {
    mockHfComplete
        .mockResolvedValueOnce(MALFORMED_LLM_OUTPUT_STRING)
        .mockResolvedValueOnce(JSON.stringify(VALID_LLM_OUTPUT))
        .mockResolvedValue(JSON.stringify(VALID_LLM_OUTPUT));

    // extractJsonFromText is synchronous, use mockReturnValue
    mockExtractJson
        .mockReturnValueOnce(null) // First call fails to find JSON
        .mockReturnValue(JSON.stringify(VALID_LLM_OUTPUT)); // Subsequent calls succeed

    const result = await Round4_Polish.runR4_Polish(RUN_ID);

    expect(result).toEqual({ polishedCount: 2, failures: 0 });
    expect(mockHfComplete).toHaveBeenCalledTimes(3); // 1 initial fail, 1 retry success, 1 for second item
  });

  it("should throw not-found if the R3 artifact does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    await expect(Round4_Polish.runR4_Polish(RUN_ID)).rejects.toThrow(
      new HttpsError("not-found", `Round 3 artifact not found for runId=${RUN_ID}`)
    );
  });

  it("should handle the case where all polishing attempts fail", async () => {
    mockHfComplete.mockRejectedValue(new Error("LLM is down"));

    const result = await Round4_Polish.runR4_Polish(RUN_ID);

    expect(result).toEqual({ polishedCount: 0, failures: 2 });
    expect(mockBatchSet).toHaveBeenCalledTimes(1); // Only the failure artifact

    const failurePath = ARTIFACT_PATHS.R4_FAILURES.replace("{runId}", RUN_ID);
    const failureCall = mockBatchSet.mock.calls.find(call => call[0].path === failurePath);
    expect(failureCall[1].items).toHaveLength(2);
  });
});
