import { ARTIFACT_PATHS } from "../../../utils/constants";
import * as hf from "../../../clients/hf";
import { HttpsError } from "firebase-functions/v2/https";

// Declare mock variables that will be used by the hoisted jest.mock
let mockSet: jest.Mock;
let mockGet: jest.Mock;
let mockDoc: jest.Mock;

// Mock Firebase
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [{}], // mock the apps array to avoid initialization errors
  firestore: Object.assign(
    jest.fn(() => ({
      // Use a factory function to delegate to the mock variable
      // This avoids the ReferenceError because mockDoc will be assigned later
      doc: (path: string) => mockDoc(path),
    })),
    {
      FieldValue: {
        serverTimestamp: jest.fn(),
      },
    }
  ),
}));

// Mock HF client
jest.mock("../../../clients/hf");

// Now that mocks are set up, import the module under test
import { run } from "../../../rounds/r1_ideate";

const mockHfComplete = hf.hfComplete as jest.Mock;

describe("Round1_Ideate", () => {
  beforeEach(() => {
    // Initialize/reset mocks before each test
    mockSet = jest.fn();
    mockGet = jest.fn();
    mockDoc = jest.fn(() => ({
      get: mockGet,
      set: mockSet,
    }));
    mockHfComplete.mockClear();
  });

  it("should throw if round 0 artifact is not found", async () => {
    mockGet.mockResolvedValue({ exists: false });
    await expect(run({ runId: "test-run-1" })).rejects.toThrow(
      new HttpsError("not-found", "Round0 artifact not found for runId=test-run-1")
    );
  });

  it("should throw if round 0 artifact has no trend items", async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ items: [], cached: false, sourceCounts: {} }) });
    await expect(run({ runId: "test-run-1" })).rejects.toThrow(
      new HttpsError("failed-precondition", "No trends found in round0 artifact for runId=test-run-1")
    );
  });

  it("should throw if the LLM produces no valid ideas", async () => {
    const r0Data = {
      items: [{ query: "test trend", score: 1, type: "trending", source: ["test"] }],
      cached: false,
      sourceCounts: { test: 1 },
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

    await expect(run({ runId: "test-run-1" })).rejects.toThrow(
        new HttpsError("internal", 'Trend "test trend" produced fewer than 3 ideas (0).')
    );
  });

  it("should successfully generate and write ideas", async () => {
    const runId = "test-run-success";
    const r0Data = {
      items: [{ query: "test trend", score: 1, type: "trending", source: ["test"] }],
      cached: false,
      sourceCounts: { test: 1 },
    };
    mockGet.mockResolvedValue({ exists: true, data: () => r0Data });

    const llmResponse = [
      {
        trend: "test trend",
        ideas: ["Idea 1", "Idea 2", "Idea 3"],
      },
    ];
    mockHfComplete.mockResolvedValue(JSON.stringify(llmResponse));

    const result = await run({ runId });

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
