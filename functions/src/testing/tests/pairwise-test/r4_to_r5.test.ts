import { hfComplete, extractJsonFromText } from "../../../clients/hf";

// --- Mocks ---------------------------------------------------------------------

// These variables must be declared before the mock implementations
let mockDoc: jest.Mock;
let mockBatchSet: jest.Mock;
let mockBatchCommit: jest.Mock;
let mockBatch: jest.Mock;

// Mock Firestore *before* the module that uses it is imported
jest.mock("firebase-admin/firestore", () => {
  // Initialize the mocks here
  mockDoc = jest.fn();
  mockBatchSet = jest.fn();
  mockBatchCommit = jest.fn().mockResolvedValue(undefined);
  mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

  return {
    getFirestore: jest.fn(() => ({
      doc: mockDoc,
      batch: mockBatch,
    })),
    FieldValue: {
      serverTimestamp: jest.fn(),
    },
  };
});

jest.mock("../../../clients/hf");

// Now, import the module to test (it will use the mocks above)
const { _test } = require("../../../rounds/r5_meta");
const { run } = _test;


// --- Test Suite ---------------------------------------------------------------
describe("Pairwise: R4 -> R5", () => {
    const runId = "pairwise-test-r4-r5";

    // Test constants
    const r4ArtifactPath = `runs/${runId}/artifacts/round4_polished_drafts`;
    const r5ArtifactPath = `runs/${runId}/artifacts/round5_meta`;

    const r4Items = [
        { idea: "The History of Espresso", polishedDraft: "Once upon a time in Italy... it was a dark and stormy night... and coffee was needed. This is a long story about coffee that is definitely more than 250 characters long so that it passes the validation check for the minimum length of the draft. More content, more content, more content, more content, more content, more content, more content, more content.", derivatives: ["d1", "d2"] },
        { idea: "Modern Art Movements", polishedDraft: "From Cubism to a new canvas... and many other things happened in the world of art. This is a long story about art that is definitely more than 250 characters long so that it passes the validation check for the minimum length of the draft. More content, more content, more content, more content, more content, more content, more content, more content.", derivatives: ["d3", "d4"] },
    ];

    // This response must match the MetaSchema in r5_meta.ts
    const llmJsonResponse = {
        seoTitle: "A Brief History of Espresso",
        metaDescription: "From its origins in Italy to its global domination, explore the rich history of espresso.",
        tags: ["espresso", "coffee", "history", "italy"],
        categories: ["Food & Drink", "History"],
        excerpt: "Delve into the fascinating journey of espresso, from its invention in 19th century Italy to becoming a global coffee phenomenon. This article explores the key innovations and cultural shifts that shaped the world's favorite strong coffee. We will cover the invention of the first espresso machines and their lasting impact on culture.", // Now > 50 words
        relatedKeywords: ["espresso history", "italian coffee", "espresso machine"],
        imageSuggestions: ["A vintage espresso machine", "A cup of freshly brewed espresso"],
    };

    let r4DocMock: { get: jest.Mock; };
    let r5SuccessDocMock: {};

    beforeEach(() => {
        // Clear mocks before each test
        jest.clearAllMocks();

        // Set up mock return values
        r4DocMock = { get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ items: r4Items }) }) };
        r5SuccessDocMock = { set: jest.fn() };

        mockDoc.mockImplementation((path: string) => {
            if (path === r4ArtifactPath) return r4DocMock;
            if (path === r5ArtifactPath) return r5SuccessDocMock;
            return { get: jest.fn().mockResolvedValue({ exists: false }) };
        });

        (hfComplete as jest.Mock).mockResolvedValue("Some LLM response");
        (extractJsonFromText as jest.Mock).mockReturnValue(JSON.stringify(llmJsonResponse));
    });

    test("R4 output feeds correctly into R5 meta generation", async () => {
        await run({runId});

        // 1. Check artifact read
        expect(r4DocMock.get).toHaveBeenCalledTimes(1);

        // 2. Check HF client calls (should not retry)
        expect(hfComplete).toHaveBeenCalledTimes(r4Items.length);
        expect(extractJsonFromText).toHaveBeenCalledTimes(r4Items.length);

        // 3. Check batch write
        expect(mockBatch).toHaveBeenCalledTimes(1);
        expect(mockBatchSet).toHaveBeenCalledTimes(1);
        expect(mockBatchCommit).toHaveBeenCalledTimes(1);

        // 4. Verify the data written to the success document
        const [docRef, writtenData] = mockBatchSet.mock.calls[0];
        expect(docRef).toBe(r5SuccessDocMock);

        expect(writtenData).toHaveProperty("items");
        expect(writtenData.items.length).toBe(r4Items.length);

        // 5. Deep inspection of the written data
        for (let i = 0; i < writtenData.items.length; i++) {
            const item = writtenData.items[i];
            const sourceItem = r4Items[i];
            expect(item).toEqual({
                idea: sourceItem.idea,
                meta: llmJsonResponse, 
            });
        }
    });
});
