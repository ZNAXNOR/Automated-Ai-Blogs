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

import { ARTIFACT_PATHS } from "../../../utils/constants";
import { _test as Round2_Outline } from "../../../rounds/r2_outline";
import * as hf from "../../../clients/hf";
import { HttpsError } from "firebase-functions/v2/https";

const mockHfComplete = hf.hfComplete as jest.Mock;

const RUN_ID = "test-run-123";

const MOCK_R1_DATA = {
  items: [
    {
      trend: "AI in Marketing",
      idea: "Using AI to Personalize Email Campaigns",
      variant: 1,
      source: "llm",
    },
  ],
};

const VALID_MOCK_LLM_RESPONSE = JSON.stringify([
  {
    trend: "AI in Marketing",
    idea: "Using AI to Personalize Email Campaigns",
    sections: [
      {
        heading: "Introduction",
        bullets: ["What is AI personalization?", "Benefits for email marketing"],
        estWordCount: 150,
      },
      {
        heading: "Conclusion",
        bullets: ["Summary of techniques", "Future of AI in email"],
        estWordCount: 200,
      },
    ],
  },
]);

const MALFORMED_JSON_LLM_RESPONSE = `[{"trend": "AI in Marketing", "idea": "...",}]`;

describe("runR2_Outline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw a not-found error if the r1 artifact does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });

    await expect(Round2_Outline.runR2_Outline(RUN_ID)).rejects.toThrow(
      new HttpsError("not-found", `Round 1 artifact not found for runId=${RUN_ID}`)
    );
    expect(mockDoc).toHaveBeenCalledWith(
      ARTIFACT_PATHS.R1_IDEATION.replace("{runId}", RUN_ID)
    );
  });

  it("should throw a failed-precondition error if the r1 artifact is empty", async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ items: [] }) });

    await expect(Round2_Outline.runR2_Outline(RUN_ID)).rejects.toThrow(
      new HttpsError("failed-precondition", "R1 artifact has no items.")
    );
  });

  it("should throw an internal error if the LLM response is not valid JSON", async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => MOCK_R1_DATA });
    mockHfComplete.mockResolvedValue(MALFORMED_JSON_LLM_RESPONSE);

    await expect(Round2_Outline.runR2_Outline(RUN_ID)).rejects.toThrow(
      new HttpsError("internal", "Failed to parse LLM response for Round 2")
    );
  });

  it("should successfully generate and write an outline", async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true, data: () => MOCK_R1_DATA });
    mockHfComplete.mockResolvedValue(VALID_MOCK_LLM_RESPONSE);

    // Act
    const result = await Round2_Outline.runR2_Outline(RUN_ID);

    // Assert
    expect(result).toEqual({ wrote: 1 });

    // Verify Firestore write
    const expectedPath = ARTIFACT_PATHS.R2_OUTLINE.replace("{runId}", RUN_ID);
    expect(mockDoc).toHaveBeenCalledWith(expectedPath);
    expect(mockSet).toHaveBeenCalled();

    // Verify data written
    const writtenData = mockSet.mock.calls[0][0];
    expect(writtenData.items).toHaveLength(1);
    expect(writtenData.items[0].sections).toHaveLength(2);
    expect(writtenData.items[0].sections[0].heading).toBe("Introduction");
    expect(writtenData.createdAt).toBe("MOCK_TIMESTAMP");
  });
});
