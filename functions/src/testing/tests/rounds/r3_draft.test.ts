const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet, set: mockSet }));

jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => ({ doc: mockDoc })), {
    FieldValue: {
      serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP"),
    },
  }),
}));

jest.mock("../../../clients/hf");

import { run } from "../../../rounds/r3_draft";
import * as hf from "../../../clients/hf";
import { HttpsError } from "firebase-functions/v2/https";
import { constants } from "../../../utils/constants";

const mockHfComplete = hf.hfComplete as jest.Mock;

const RUN_ID = "test-run-456";

const MOCK_R2_DATA = {
  items: [
    {
      trend: "Sustainable Fashion",
      idea: "The Rise of Upcycled Clothing",
      sections: [
        { heading: "Intro", bullets: ["What is upcycling?"], estWordCount: 50 },
        { heading: "Outro", bullets: ["Future of fashion."], estWordCount: 50 },
      ],
    },
    {
      trend: "Ancient Grains",
      idea: "Quinoa: The Superfood of the Incas",
      sections: [{ heading: "History", bullets: ["Incan usage"], estWordCount: 100 }],
    },
  ],
};

const VALID_DRAFT_RESPONSE = "This is a perfectly valid draft that meets the word count requirements. It is sufficiently long. ".repeat(20);
const SHORT_DRAFT_RESPONSE = "This is too short.";

describe("runR3_Draft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true, data: () => MOCK_R2_DATA });
  });

  it("should fetch R2 data, generate drafts for all items, and write them to a new artifact", async () => {
    mockHfComplete.mockResolvedValue(VALID_DRAFT_RESPONSE);

    const result = await run({ runId: RUN_ID });

    expect(result).toEqual({ draftsCreated: 2, failures: 0 });
    expect(mockDoc).toHaveBeenCalledWith(constants.ARTIFACT_PATHS.R2_OUTLINES.replace("{runId}", RUN_ID));
    expect(mockHfComplete).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenCalledTimes(1);

    const writtenData = mockSet.mock.calls[0][0];
    expect(writtenData.items).toHaveLength(2);
    expect(writtenData.items[0].wordCount).toBeGreaterThan(250);
    expect(writtenData.items[1].trend).toBe("Ancient Grains");
    expect(writtenData.createdAt).toBe("MOCK_TIMESTAMP");
  });

  it("should throw an error if the R2 artifact is not found", async () => {
    mockGet.mockResolvedValue({ exists: false });
    await expect(run({ runId: RUN_ID })).rejects.toThrow(
      new HttpsError("not-found", `Round 2 artifact not found for runId=${RUN_ID}`)
    );
  });

  it("should handle failures in draft generation for some items", async () => {
    mockHfComplete
      .mockResolvedValueOnce(VALID_DRAFT_RESPONSE) 
      .mockRejectedValueOnce(new Error("HF API is down"));

    const result = await run({ runId: RUN_ID });

    expect(result).toEqual({ draftsCreated: 1, failures: 1 });
    expect(mockSet).toHaveBeenCalledTimes(1);
    const writtenData = mockSet.mock.calls[0][0];
    expect(writtenData.items).toHaveLength(1);
    expect(writtenData.items[0].trend).toBe("Sustainable Fashion");
  });

  it("should retry draft generation if word count is not met", async () => {
    mockHfComplete
      .mockResolvedValueOnce(SHORT_DRAFT_RESPONSE)
      .mockResolvedValueOnce(VALID_DRAFT_RESPONSE)
      .mockResolvedValue(VALID_DRAFT_RESPONSE); // For the second item

    const result = await run({ runId: RUN_ID });

    expect(result).toEqual({ draftsCreated: 2, failures: 0 });
    expect(mockHfComplete).toHaveBeenCalledTimes(3); // 1 initial + 1 retry for the first item, 1 for the second
  });

  it("should fail an item if it repeatedly fails to meet word count", async () => {
    mockHfComplete.mockResolvedValue(SHORT_DRAFT_RESPONSE);

    const result = await run({ runId: RUN_ID });

    expect(result).toEqual({ draftsCreated: 0, failures: 2 });
    expect(mockSet).toHaveBeenCalledTimes(1);
    const writtenData = mockSet.mock.calls[0][0];
    expect(writtenData.items).toHaveLength(0);
  });
});
