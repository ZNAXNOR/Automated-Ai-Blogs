import { ARTIFACT_PATHS } from "../../../utils/constants";
import { Round1_Ideate } from "../../../rounds/r1_ideate";
import * as admin from "firebase-admin";
import * as hf from "../../../clients/hf";
import { HttpsError } from "firebase-functions/v2/https";

// Mock Firebase
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    doc: jest.fn(),
  })),
}));

const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({
  get: mockGet,
  set: mockSet,
}));
(admin.firestore as jest.Mock).mockReturnValue({ doc: mockDoc });

// Mock HF client
jest.mock("../../../clients/hf");
const mockHfComplete = hf.hfComplete as jest.Mock;

describe("Round1_Ideate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw if round 0 artifact is not found", async () => {
    mockGet.mockResolvedValue({ exists: false });
    await expect(Round1_Ideate({ data: { runId: "test-run-1" } } as any)).rejects.toThrow(
      new HttpsError("not-found", "Round0 artifact not found for runId=test-run-1")
    );
  });

  it("should throw if round 0 artifact has no trend items", async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ items: [] }) });
    await expect(Round1_Ideate({ data: { runId: "test-run-1" } } as any)).rejects.toThrow(
      new HttpsError("failed-precondition", "No trends found in round0 artifact for runId=test-run-1")
    );
  });

  it("should throw if the LLM produces no valid ideas", async () => {
    const r0Data = {
      items: [{ query: "test trend", score: 1, type: "trending", source: ["test"] }],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r0Data });
    mockHfComplete.mockResolvedValue(
      JSON.stringify([
        {
          trend: "test trend",
          ideas: [], // no ideas
        },
      ])
    );

    await expect(Round1_Ideate({ data: { runId: "test-run-1" } } as any)).rejects.toThrow(
        new HttpsError("internal", 'Trend "test trend" produced fewer than 3 ideas (0).')
    );
  });

  it("should successfully generate and write ideas", async () => {
    const runId = "test-run-success";
    const r0Data = {
      items: [{ query: "test trend", score: 1, type: "trending", source: ["test"] }],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r0Data });

    const llmResponse = [
      {
        trend: "test trend",
        ideas: ["Idea 1", "Idea 2", "Idea 3"],
      },
    ];
    mockHfComplete.mockResolvedValue(JSON.stringify(llmResponse));

    const result = await Round1_Ideate({ data: { runId } } as any);

    expect(result).toHaveProperty("wrote");
    expect(result.wrote).toBe(3);

    // Verify firestore write
    expect(mockDoc).toHaveBeenCalledWith(
      ARTIFACT_PATHS.R1_IDEATION.replace("{runId}", runId)
    );
    expect(mockSet).toHaveBeenCalled();
    const writtenData = mockSet.mock.calls[0][0];
    expect(writtenData.items).toHaveLength(3);
    expect(writtenData.items[0].idea).toBe("Idea 1");
  });
});
