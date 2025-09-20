import { Round5_Meta } from "../../../rounds/r5_meta";
import { Round6_Coherence } from "../../../rounds/r6_coherence";

// --- Mocking Firestore ---
const firestoreWrites: { [key: string]: any } = {};

const batchSetMock = (docRef: { path: string }, data: any) => {
  const writePath = docRef.path;
  console.log(`Firestore BATCH SET called for doc: ${writePath}`);
  firestoreWrites[writePath] = data;
};

const collectionMock = (path: string) => ({
    get: async () => {
      console.log(`Firestore GET called for collection: ${path}`);
      const mockData = {
        docs: [
          {
            id: "test-run-123-polished-0",
            data: () => ({ 
              polished: "This is a polished text.", 
              derivatives: ["derivative 1", "derivative 2"],
              metadata: { title: "Test Title" }
            })
          },
          {
            id: "test-run-123-polished-1",
            data: () => ({ 
              polished: "This is another polished text.", 
              derivatives: ["derivative 3", "derivative 4"],
              metadata: { title: "Another Title" }
            })
          },
          {
            id: "test-run-123-no-derivatives",
            data: () => ({ 
              polished: "This is a polished text with no derivatives.",
              metadata: { title: "No Derivatives Title" }
            })
          }
        ]
      };
      return Promise.resolve(mockData);
    },
    doc: (docId: string) => ({
      path: `${path}/${docId}`,
      set: async (data: any) => {
        const writePath = `${path}/${docId}`;
        console.log(`Firestore SET called for doc: ${writePath}`);
        firestoreWrites[writePath] = data;
        return Promise.resolve();
      }
    })
  });

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: collectionMock,
    batch: () => ({
      set: batchSetMock,
      commit: async () => {
        console.log("Firestore BATCH COMMIT called");
        return Promise.resolve();
      }
    })
  }),
  FieldValue: {
    serverTimestamp: () => 'mock-server-timestamp'
  }
}));

// --- Mocking Hugging Face API ---
jest.mock("node-fetch", () => ({
    __esModule: true, // This is important for ESM modules
    default: jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [0.9, 0.95] as any,
    }),
  }));

// --- Mocking Config ---
jest.mock("../../../utils/config", () => ({
    env: {
      hfToken: "test-hf-token",
      hfModelR6: "test-model-r6",
    },
  }));

describe("R5 → R6 Pairwise Integration", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key in firestoreWrites) {
      delete firestoreWrites[key];
    }
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should correctly prepare inputs and run R6 coherence check", async () => {
    const runId = "test-run-123";

    // Step 1: Execute Round6_Coherence
    await Round6_Coherence(runId);

    // Step 2: Validate Firestore collection gets
    expect(consoleLogSpy).toHaveBeenCalledWith("Firestore GET called for collection: runs/test-run-123/artifacts/round4_distribution");

    // Step 3: Validate Hugging Face API calls
    const fetch = require("node-fetch").default;
    expect(fetch).toHaveBeenCalledTimes(2); // Two valid documents to process

    // Step 4: Validate Firestore writes
    expect(Object.keys(firestoreWrites).length).toBe(2); 

    // Step 5: Validate the data written to Firestore
    const firstWriteKey = `runs/test-run-123/artifacts/round6/test-run-123-polished-0`;
    const firstWrite = firestoreWrites[firstWriteKey];
    expect(firstWrite).toBeDefined();
    expect(firstWrite.coherenceScore).toBeCloseTo(0.925);
    expect(firstWrite.validatedText).toEqual("This is a polished text.");
    expect(firstWrite.derivatives).toEqual(["derivative 1", "derivative 2"]);

    const secondWriteKey = `runs/test-run-123/artifacts/round6/test-run-123-polished-1`;
    const secondWrite = firestoreWrites[secondWriteKey];
    expect(secondWrite).toBeDefined();
    expect(secondWrite.coherenceScore).toBeCloseTo(0.925);
    expect(secondWrite.validatedText).toEqual("This is another polished text.");
    expect(secondWrite.derivatives).toEqual(["derivative 3", "derivative 4"]);

    // Step 6: Verify logs for success
    expect(consoleLogSpy).toHaveBeenCalledWith("R6: Starting Round 6 for runId=test-run-123");
    expect(consoleLogSpy).toHaveBeenCalledWith("R6: Found 2 drafts to process.");
    expect(consoleLogSpy).toHaveBeenCalledWith("R6: Successfully calculated coherence for 2 drafts.");
    expect(consoleLogSpy).toHaveBeenCalledWith("R6: Successfully saved 2 coherence scores.");
    expect(consoleLogSpy).toHaveBeenCalledWith("R6: Round 6 finished for runId=test-run-123.");
  });
});
