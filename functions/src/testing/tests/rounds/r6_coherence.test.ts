const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDoc = jest.fn((path) => ({ get: mockGet, set: mockSet, path }));
const mockBatchCommit = jest.fn();
const mockBatchSet = jest.fn();
const mockBatch = jest.fn(() => ({
  commit: mockBatchCommit,
  set: mockBatchSet,
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

jest.mock("../../../clients/hf_sentence", () => ({
  __esModule: true,
  calculateSimilarity: jest.fn(),
}));

import { _test as Round6_Coherence } from "../../../rounds/r6_coherence";
import * as hfSentence from "../../../clients/hf_sentence";
import { HttpsError } from "firebase-functions/v2/https";
import { ARTIFACT_PATHS } from "../../../utils/constants";

const mockCalculateSimilarity = hfSentence.calculateSimilarity as jest.Mock;

const RUN_ID = "test-run-coherence-456";

const MOCK_R4_DATA = {
  items: [
    {
      idea: "The Future of Transportation",
      polishedDraft: "Autonomous vehicles are set to revolutionize how we travel...",
      derivatives: [
        "Self-driving cars are the future! #tramsportation",
        "Get ready for a world with no traffic jams, thanks to autonomous vehicles.",
      ],
    },
    {
      idea: "The Rise of Superfoods",
      polishedDraft: "From kale to quinoa, superfoods are taking over our kitchens...",
      derivatives: [
        "Supercharge your diet with these amazing superfoods! #health",
        "Discover the benefits of adding nutrient-dense foods to your meals.",
      ],
    },
  ],
};

describe("runR6_Coherence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true, data: () => MOCK_R4_DATA });
  });

  it("should calculate coherence for all drafts successfully", async () => {
    mockCalculateSimilarity.mockResolvedValue([0.9, 0.85]);

    const result = await Round6_Coherence.runR6_Coherence(RUN_ID);

    expect(result).toEqual({ coherenceCount: 2, failures: 0 });
    expect(mockCalculateSimilarity).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);

    const successPath = ARTIFACT_PATHS.R6_COHERENCE.replace("{runId}", RUN_ID);
    const writtenData = mockBatchSet.mock.calls[0][1];
    expect(mockDoc).toHaveBeenCalledWith(successPath);
    expect(writtenData.items).toHaveLength(2);
    expect(writtenData.items[0].idea).toBe("The Future of Transportation");
    expect(writtenData.items[0].coherenceScore).toBeCloseTo(0.875);
  });

  it("should handle a mix of successful and failed coherence calculations", async () => {
    mockCalculateSimilarity
      .mockResolvedValueOnce([0.95, 0.92])
      .mockRejectedValueOnce(new Error("HF is down"));

    const result = await Round6_Coherence.runR6_Coherence(RUN_ID);

    expect(result).toEqual({ coherenceCount: 1, failures: 1 });
    expect(mockCalculateSimilarity).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
  });

  it("should throw not-found if the R4 artifact does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });

    await expect(Round6_Coherence.runR6_Coherence(RUN_ID)).rejects.toThrow(
      new HttpsError("not-found", `Round 4 artifact not found for runId=${RUN_ID}`)
    );
  });

  it("should handle the case where all coherence calculations fail", async () => {
    mockCalculateSimilarity.mockRejectedValue(new Error("HF is completely down"));

    const result = await Round6_Coherence.runR6_Coherence(RUN_ID);

    expect(result).toEqual({ coherenceCount: 0, failures: 2 });
    expect(mockBatchSet).not.toHaveBeenCalled();
  });
});
