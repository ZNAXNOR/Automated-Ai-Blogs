/**
 * Pairwise Chain Test: R3 → R4
 *
 * Ensures that the draft output of Round 3 can be consumed by
 * Round 4 (Polish & Derive) without schema mismatch or errors.
 */
import { Round4_Polish, R4PolishedItem, R3DraftDocument } from "../../../rounds/r4_polish";
import { LLMClient } from "../../../utils/llmClient";

// --- Sample R3 draft input ---
const mockR3Drafts: R3DraftDocument[] = [
  { runId: "pairwise-test-r3-r4", trend: "AI in healthcare", idea: "AI transforming healthcare", draft: "Raw draft text here.", wordCount: 120 },
  { runId: "pairwise-test-r3-r4", trend: "Remote work", idea: "Remote productivity tips", draft: "Another raw draft.", wordCount: 80 },
];

// --- Mock Firestore ---
const mockBatchSet = jest.fn();
const mockCommit = jest.fn(() => Promise.resolve());
const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockCommit }));
const mockGet = jest.fn(() => Promise.resolve({ exists: true, data: () => ({ items: mockR3Drafts }) }));

const docMock = jest.fn((path: string) => ({
    path: path,
    get: mockGet,
    collection: (subPath: string) => collectionMock(`${path}/${subPath}`),
}));

const collectionMock = jest.fn((path: string) => ({
    doc: (docId?: string) => docMock(`${path}/${docId || 'new-doc'}`),
}));

const firestoreMock = {
    doc: docMock,
    batch: mockBatch,
    collection: collectionMock,
};

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => firestoreMock,
  FieldValue: { serverTimestamp: () => Date.now() },
}));

// --- Mock LLMClient ---
jest.mock("../../../utils/llmClient");

describe("Pairwise Test: R3 -> R4", () => {
  const RUN_ID = "pairwise-test-r3-r4";
  let llmMock: jest.Mocked<LLMClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    llmMock = new LLMClient() as jest.Mocked<LLMClient>;
    // Reset mocks on the firestore object
    collectionMock.mockClear();
    docMock.mockClear();
    mockGet.mockClear();
    mockBatchSet.mockClear();
    mockCommit.mockClear();
  });

  test("R3 output should be correctly processed by R4", async () => {
    // --- Mock LLM response ---
    const mockLlmResponse = {
      polished: "This is a polished draft.",
      derivatives: ["Social post 1", "Email snippet 1"],
    };
    // The llmApiCall dependency expects a function that returns a raw string,
    // not an object. We create a wrapper to simulate this.
    const llmApiCallMock = jest.fn(async (prompt: string) => {
        return `\`\`\`json\n${JSON.stringify(mockLlmResponse)}\n\`\`\``;
    });


    // --- Run Round 4 ---
    await Round4_Polish(RUN_ID, { llmApiCall: llmApiCallMock, firestore: firestoreMock as any });

    // --- Assertions ---

    // 1. Check if R3 artifact was read
    expect(firestoreMock.doc).toHaveBeenCalledWith(`runs/${RUN_ID}/artifacts/round3`);
    expect(mockGet).toHaveBeenCalledTimes(1);

    // 2. Check LLM calls
    expect(llmApiCallMock).toHaveBeenCalledTimes(mockR3Drafts.length);

    // 3. Check if R4 artifacts were written
    expect(firestoreMock.collection).toHaveBeenCalledWith(`runs/${RUN_ID}/artifacts/round4_distribution`);
    expect(mockBatchSet).toHaveBeenCalled(); 

    // 4. Deep inspection of the written data
    const mainArtifactCall = mockBatchSet.mock.calls.find(call => call[0].path.endsWith('round4'));
    expect(mainArtifactCall).toBeDefined();

    const writtenData = mainArtifactCall[1];
    expect(writtenData).toHaveProperty("items");
    const items = writtenData.items as R4PolishedItem[];
    expect(items.length).toBe(mockR3Drafts.length);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sourceDraft = mockR3Drafts[i];
        expect(item.runId).toBe(RUN_ID);
        expect(item.trend).toBe(sourceDraft.trend);
        expect(item.idea).toBe(sourceDraft.idea);
        expect(item.originalDraft).toBe(sourceDraft.draft);
        expect(item.polished).toBe(mockLlmResponse.polished);
        expect(item.derivatives).toEqual(mockLlmResponse.derivatives);
    }
  }, 20000); 
});
