import { hfComplete, extractJsonFromText } from "../../../clients/hf";

// --- Mocks ---------------------------------------------------------------------
// These variables are hoisted, so they can be referenced by the hoisted jest.mock call.
const mockDoc = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

// Mock the entire firebase-admin/firestore module.
// This mock is hoisted above all imports.
jest.mock("firebase-admin/firestore", () => ({
    getFirestore: jest.fn(() => ({
        doc: mockDoc,
        batch: mockBatch,
    })),
    FieldValue: {
        serverTimestamp: jest.fn(),
    },
}));

// Mock the hf client module
jest.mock("../../../clients/hf");

// Import the module to test *after* all mocks have been set up.
import { run } from "../../../rounds/r4_polish";

// --- Test Suite ---------------------------------------------------------------
describe("Pairwise: R3 -> R4", () => {
    const runId = "pairwise-test-r3-r4";

    // Test constants
    const r3ArtifactPath = `runs/${runId}/artifacts/round3_drafts`;
    const r4ArtifactPath = `runs/${runId}/artifacts/round4_polished_drafts`;
    const r4FailuresPath = `runs/${runId}/artifacts/round4_failures`;

    const r3Items = [
        { idea: "The History of Espresso", draft: "Once upon a time in Italy..." },
        { idea: "Modern Art Movements", draft: "From Cubism to a new canvas..." },
    ];
    
    const polished = "This is a much longer, more realistic polished draft that is absolutely guaranteed to be over one hundred characters long, hopefully satisfying the validation requirements of the schema.";
    const derivatives = ["This is a derivative social media post.", "This is another derivative, a tweet thread."];
    const validJsonResponse = { polished, derivatives };

    // Declare mock docs here to be accessible in all tests
    let r3DocMock: { get: jest.Mock; };
    let r4SuccessDocMock: {};
    let r4FailureDocMock: {};

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Set up mock documents for this test run
        r3DocMock = { get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ items: r3Items }) }) };
        r4SuccessDocMock = { set: jest.fn() }; // This object will be used for identity check
        r4FailureDocMock = { set: jest.fn() };

        mockDoc.mockImplementation((path: string) => {
            if (path === r3ArtifactPath) return r3DocMock;
            if (path === r4ArtifactPath) return r4SuccessDocMock;
            if (path === r4FailuresPath) return r4FailureDocMock;
            return { get: jest.fn().mockResolvedValue({ exists: false }) }; // Default mock
        });

        // Mock the HF client responses
        (hfComplete as jest.Mock).mockResolvedValue("Some LLM response string");
        (extractJsonFromText as jest.Mock).mockReturnValue(JSON.stringify(validJsonResponse));
    });

    test("R3 output feeds correctly into R4 polish generation", async () => {
        // Run Round 4 directly
        await run({ runId });

        // 1. Check if the correct artifact was read
        expect(r3DocMock.get).toHaveBeenCalledTimes(1);

        // 2. Check if the hf client was called correctly
        expect(hfComplete).toHaveBeenCalledTimes(r3Items.length);
        expect(extractJsonFromText).toHaveBeenCalledTimes(r3Items.length);

        // 3. Check if the output artifacts were written correctly via the batch
        expect(mockBatch).toHaveBeenCalledTimes(1);
        expect(mockBatchSet).toHaveBeenCalledTimes(1);
        expect(mockBatchCommit).toHaveBeenCalledTimes(1);

        // 4. Verify the data written to the success document
        const [docRef, writtenData] = mockBatchSet.mock.calls[0];
        expect(docRef).toBe(r4SuccessDocMock); // Ensures the correct document reference was used

        expect(writtenData).toHaveProperty("items");
        expect(Array.isArray(writtenData.items)).toBe(true);
        expect(writtenData.items.length).toBe(r3Items.length);

        // 5. Deep inspection of the written data
        for (let i = 0; i < writtenData.items.length; i++) {
            const item = writtenData.items[i];
            const sourceItem = r3Items[i];
            expect(item).toEqual({
                idea: sourceItem.idea,
                polishedDraft: polished,
                derivatives: derivatives,
            });
        }
    });
});
