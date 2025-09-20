jest.mock("node-fetch", () => jest.fn());

import { Round6_Coherence, _test as r6_test_functions } from "../../../rounds/r6_coherence";
import fetch from "node-fetch";
const { runR6_Coherence } = r6_test_functions;
const mockedFetch = fetch as unknown as jest.Mock;

// Mock environment variables
jest.mock("../../../utils/config", () => ({
  env: {
    hfToken: "test-token",
    hfModelR6: "test-model",
  },
}));


// --- Mocking Firestore -- -
const firestoreWrites: { [key: string]: any } = {};
const collectionGetMock = jest.fn().mockResolvedValue({
    empty: false,
    docs: [
        {
            id: 'draft1',
            data: () => ({
                polished: 'This is the first polished draft.',
                derivatives: ['derivative A', 'derivative B'],
            }),
        },
        {
            id: 'draft2',
            data: () => ({
                polished: 'This is the second polished draft.',
                derivatives: ['derivative C', 'derivative D'],
            }),
        },
    ],
});

const batchSetMock = jest.fn((docRef, data) => {
    firestoreWrites[docRef.path] = data;
});
const batchCommitMock = jest.fn().mockResolvedValue(undefined);

const collectionMock = (path: string) => ({
    get: collectionGetMock,
    doc: (docId: string) => ({
        path: `${path}/${docId}`,
    }),
});

jest.mock("firebase-admin/firestore", () => ({
    getFirestore: () => ({
        collection: collectionMock,
        batch: () => ({
            set: batchSetMock,
            commit: batchCommitMock,
        }),
    }),
    FieldValue: {
        serverTimestamp: () => 'mock-server-timestamp',
    },
}));


describe("r6_coherence Core Functionality", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedFetch.mockReset();
    });

    it("should calculate coherence score correctly", async () => {
        mockedFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([0.8, 0.9, 0.85]),
        });

        const draftId = "test-draft-id";
        const polishedText = "This is a test.";
        const derivatives = ["A similar test.", "Another similar test."];

        const result = await runR6_Coherence(draftId, polishedText, derivatives);

        expect(result).toHaveProperty("draftId");
        expect(result).toHaveProperty("coherenceScore");
        expect(result.draftId).toBe(draftId);
        expect(typeof result.coherenceScore).toBe("number");
        expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            headers: {
                Authorization: `Bearer test-token`,
                "Content-Type": "application/json",
            }
        }));
    });

    it("should handle empty derivatives array", async () => {
        const draftId = "test-draft-id";
        const polishedText = "This is a test.";
        const derivatives: string[] = [];

        await expect(runR6_Coherence(draftId, polishedText, derivatives)).rejects.toThrow(
            "Missing or invalid required fields: draftId, polishedText, or derivatives"
        );
    });

    it("should handle API errors gracefully", async () => {
        mockedFetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: "Server Error",
        });

        const draftId = "test-draft-id";
        const polishedText = "This is a test.";
        const derivatives = ["A similar test.", "Another similar test."];

        await expect(runR6_Coherence(draftId, polishedText, derivatives)).rejects.toThrow(
            "HF API error: 500 Server Error"
        );
    });
});


describe("r6_coherence Core Functionality & Firestore Writes", () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockedFetch.mockReset();
        for (const key in firestoreWrites) {
            delete firestoreWrites[key];
        }
    });

    it("should calculate coherence, save to Firestore, and match snapshot", async () => {
        mockedFetch.mockResolvedValue({
            ok: true,
            json: async () => [0.9, 0.95],
        });

        const runId = "test-run-for-snapshot";
        await Round6_Coherence(runId);

        expect(collectionGetMock).toHaveBeenCalledWith(`runs/${runId}/artifacts/round4_distribution`);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(batchCommitMock).toHaveBeenCalledTimes(1);

        // Sort keys to ensure consistent snapshot
        const sortedWrites = Object.keys(firestoreWrites).sort().reduce(
            (acc, key) => {
                acc[key] = firestoreWrites[key];
                return acc;
            }, {} as { [key: string]: any }
        );

        expect(sortedWrites).toMatchSnapshot();
    });
});
