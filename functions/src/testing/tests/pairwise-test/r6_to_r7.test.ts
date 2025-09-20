export {};
const { Round7_Publish } = require("../../../rounds/r7_publish");

// Mock dependencies
jest.mock("../../../clients/http", () => ({
    httpClient: {
        request: jest.fn(),
    },
}));

// A variable to hold the mock Firestore instance, which we will configure in each test.
let mockFirestore: any;
let mockBatch: any;
jest.mock("firebase-admin/firestore", () => ({
    getFirestore: () => mockFirestore,
    Timestamp: {
        now: () => ({
            toDate: () => new Date(),
        }),
    },
}));

describe("Round7_Publish Enhanced Tests", () => {
    const runId = "test-run-r7-enhanced";
    const { httpClient } = require("../../../clients/http");

    // In-memory representation of the database for our tests.
    let firestoreDB: { [path: string]: any } = {};

    const mockR6Artifacts = {
        "valid-draft-1": { trendId: "valid-draft-1", validatedText: "Valid content here.", metadata: { title: "Valid Title 1", description: "Valid desc.", tags: ["tech"] } },
        "valid-draft-2": { trendId: "valid-draft-2", validatedText: "More valid content.", metadata: { title: "Valid Title 2", description: "Valid desc.", tags: ["health"] } },
        "draft-to-be-skipped": { trendId: "draft-to-be-skipped", validatedText: "This content already exists.", metadata: { title: "Skipped Title", description: "Skipped desc.", tags: [] } },
        "draft-with-api-error": { trendId: "draft-with-api-error", validatedText: "This one will fail.", metadata: { title: "Failure Title", description: "Failure desc.", tags: ["fail"] } },
        "draft-with-bad-response": { trendId: "draft-with-bad-response", validatedText: "WP response is invalid.", metadata: { title: "Bad Response Title", description: "Bad desc.", tags: [] } },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        firestoreDB = {}; // Reset the in-memory DB

        // Pre-populate R6 artifacts
        const r6Path = `runs/${runId}/artifacts/round6`;
        for (const [docId, data] of Object.entries(mockR6Artifacts)) {
            firestoreDB[`${r6Path}/${docId}`] = data;
        }

        // Pre-populate one R7 artifact to test the skip logic
        const r7Path = `runs/${runId}/artifacts/round7`;
        firestoreDB[`${r7Path}/existing-doc`] = { trendId: "draft-to-be-skipped", status: "draft" };

        mockBatch = {
            set: jest.fn(),
            commit: jest.fn().mockResolvedValue(undefined),
        };

        // Configure the main Firestore mock
        mockFirestore = {
            batch: () => mockBatch,
            collection: jest.fn().mockImplementation((path: string) => {
                if (path.includes("round6")) {
                    return {
                        get: async () => {
                            const docs = Object.entries(firestoreDB)
                                .filter(([key]) => key.startsWith(path))
                                .map(([key, value]) => ({ id: key.split("/").pop(), data: () => value }));
                            return { docs, empty: docs.length === 0 };
                        },
                    };
                }
                if (path.includes("round7")) {
                    return {
                        where: (field: string, op: string, value: any) => ({
                            limit: (limit: number) => ({
                                get: async () => {
                                    const docs = Object.entries(firestoreDB)
                                        .filter(([key, doc]:[string, any]) => key.startsWith(path) && doc[field] === value)
                                        .slice(0, limit)
                                        .map(([key, doc]:[string, any]) => ({ id: key.split("/").pop(), data: () => doc }));
                                    return { docs, empty: docs.length === 0 };
                                },
                            }),
                        }),
                        get: async () => {
                            const docs = Object.entries(firestoreDB)
                                .filter(([key]) => key.startsWith(path))
                                .map(([key, value]) => ({ id: key.split("/").pop(), data: () => value }));
                            return { docs, empty: docs.length === 0 };
                        },
                        doc: jest.fn(() => ({})), // Return a mock doc
                    };
                }
                return { doc: () => ({ set: jest.fn() }) };
            }),
        };
    });

    it("should process all drafts, succeeding, failing, and skipping as expected", async () => {
        httpClient.request.mockImplementation((config: any) => {
            if (config.url.includes("/posts")) {
                const body = config.data; 
                if (body.title === "Failure Title") {
                    return Promise.reject(new Error("WordPress API Error"));
                }
                if (body.title === "Bad Response Title") {
                    return Promise.resolve({ status: 500, data: { message: "ID is missing" } });
                }
                return Promise.resolve({ status: 201, data: { id: Math.floor(Math.random() * 1000) } });
            }
            return Promise.resolve({ data: [{ id: 1 }] }); // For tag lookup
        });

        const summary = await Round7_Publish(runId);

        expect(summary.processed).toBe(Object.keys(mockR6Artifacts).length);
        expect(summary.succeeded).toBe(2);
        expect(summary.skipped).toBe(1);
        expect(summary.failed).toBe(2);

        expect(mockBatch.set).toHaveBeenCalledTimes(4);
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);

        // Verify success records were written to the batch
        const successCalls = mockBatch.set.mock.calls.filter((call: any) => call[1].status === 'draft');
        expect(successCalls.length).toBe(2);
        expect(successCalls.map((c: any) => c[1].trendId)).toEqual(expect.arrayContaining(["valid-draft-1", "valid-draft-2"]));
        
        // Verify failure records were written
        const errorCalls = mockBatch.set.mock.calls.filter((call: any) => call[1].status === 'error');
        expect(errorCalls.length).toBe(2);
        expect(errorCalls.map((c: any) => c[1].trendId)).toEqual(expect.arrayContaining(["draft-with-api-error", "draft-with-bad-response"]));
    });
});
