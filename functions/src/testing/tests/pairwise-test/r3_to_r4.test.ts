/**
 * Pairwise Chain Test: R3 → R4
 *
 * Ensures that the draft output of Round 3 can be consumed by
 * Round 4 (Polish & Derive) without schema mismatch or errors.
 */
import { Round4_Polish } from "../../../rounds/r4_polish";
import { DraftItem, PolishedDraftItem } from "../../../utils/schema";
import { ResponseWrapper } from "../../../utils/responseHelper";

// --- Sample R3 draft input ---
const mockR3Drafts: DraftItem[] = [
  { idea: "AI transforming healthcare", draft: "Raw draft text here." },
  { idea: "Remote productivity tips", draft: "Another raw draft." },
];

// --- Mock Firestore ---
const mockBatchSet = jest.fn();
const mockCommit = jest.fn(() => Promise.resolve());
const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockCommit }));

// Mock for the document that contains the R3 drafts
const mockGet = jest.fn(() => Promise.resolve({ 
    exists: true, 
    data: () => ({ items: mockR3Drafts }) 
}));

const docMock = jest.fn((path: string) => ({
    path: path,
    get: mockGet,
    set: jest.fn(), // for saving r4 output
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
  FieldValue: { serverTimestamp: () => "MOCK_TIMESTAMP" },
}));

describe("Pairwise Test: R3 -> R4", () => {
  const RUN_ID = "pairwise-test-r3-r4";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("R3 output should be correctly processed by R4", async () => {
    // --- Mock LLM response ---
    const mockLlmResponse = {
      polished: "This is a polished version of the draft.",
      derivatives: ["Tweet: A polished draft is here!", "Email: Check out this great new article."],
    };

    const llmResponseWrapper = {
        json: jest.fn().mockResolvedValue(mockLlmResponse),
    } as unknown as ResponseWrapper;

    const llmApiCallMock = jest.fn().mockResolvedValue(llmResponseWrapper);

    // --- Run Round 4 ---
    await Round4_Polish(RUN_ID, { llmApiCall: llmApiCallMock, firestore: firestoreMock as any });

    // --- Assertions ---

    // 1. Check if R3 artifact was read
    expect(firestoreMock.doc).toHaveBeenCalledWith(`runs/${RUN_ID}/artifacts/round3_draft`);
    expect(mockGet).toHaveBeenCalledTimes(1);

    // 2. Check LLM calls
    expect(llmApiCallMock).toHaveBeenCalledTimes(mockR3Drafts.length);

    // 3. Check if R4 artifacts were written using a batch
    expect(firestoreMock.batch).toHaveBeenCalledTimes(1);
    expect(mockBatchSet).toHaveBeenCalledTimes(1); // Only one successful artifact
    expect(mockCommit).toHaveBeenCalledTimes(1);

    // 4. Deep inspection of the written data
    const batchCall = mockBatchSet.mock.calls[0];
    const writtenData = batchCall[1];
    
    expect(batchCall[0].path).toBe(`runs/${RUN_ID}/artifacts/round4_polished_draft`);

    expect(writtenData).toHaveProperty("items");
    const items = writtenData.items as PolishedDraftItem[];
    expect(items.length).toBe(mockR3Drafts.length);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sourceDraft = mockR3Drafts[i];
        expect(item.idea).toBe(sourceDraft.idea);
        expect(item.polishedDraft).toBe(mockLlmResponse.polished);
    }
  }, 20000); 
});
