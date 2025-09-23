jest.mock("node-fetch", () => jest.fn());

import { Round6_Coherence } from "../../../rounds/r6_coherence";

import fetch from "node-fetch";
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

const collectionMock = jest.fn((path: string) => {
    if (path.includes("round4_distribution")) {
        return {
            get: collectionGetMock
        };
    }
    return {
        doc: (docId: string) => ({
            path: `${path}/${docId}`,
        }),
    }
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

        expect(collectionMock).toHaveBeenCalledWith(`runs/${runId}/artifacts/round4_distribution`);
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
