import { Round0_Trends as runRound0 } from "../../../rounds/r0_trends";
import { Round1_Ideate as runRound1 } from "../../../rounds/r1_ideate";
import { hfComplete } from "../../../clients/hf";

// Hoisted mock variables
const mockDocs = new Map<string, { get: jest.Mock; set: jest.Mock }>();

// Mock the entire firebase-admin/firestore module
jest.mock("firebase-admin/firestore", () => ({
    getFirestore: jest.fn(() => ({
        doc: (path: string) => {
            if (!mockDocs.has(path)) {
                mockDocs.set(path, {
                    get: jest.fn().mockResolvedValue({ exists: false }),
                    set: jest.fn(),
                });
            }
            return mockDocs.get(path);
        },
    })),
    FieldValue: {
        serverTimestamp: jest.fn(),
    },
}));

jest.mock("../../../clients/serp", () => ({
    getSerpSuggestions: jest.fn().mockResolvedValue(["Suggestion 1", "Suggestion 2"]),
    getSerpRelated: jest.fn().mockResolvedValue(["Related 1", "Related 2"]),
    getSerpTrending: jest.fn().mockResolvedValue(["Trending 1", "Trending 2"]),
    serpAvailable: jest.fn().mockReturnValue(true),
}));

jest.mock("../../../clients/hf");

describe("Pairwise: R0 -> R1", () => {
    const runId = "pairwise-test-r0-r1";

    beforeEach(() => {
        jest.clearAllMocks();
        mockDocs.clear();
    });

    test("R0 output feeds correctly into R1 ideation", async () => {
        const r0ArtifactPath = `runs/${runId}/artifacts/round0_trends`;
        const r1ArtifactPath = `runs/${runId}/artifacts/round1_ideas`;

        // Mock a valid R0 output
        const r0Data = {
            items: [
                { query: "Test Trend", type: "trending", score: 1, source: ["test"] },
            ],
            cached: false,
            sourceCounts: { test: 1 },
        };
        const r0DocMock = {
            get: jest.fn().mockResolvedValue({ exists: true, data: () => r0Data }),
            set: jest.fn(),
        };
        mockDocs.set(r0ArtifactPath, r0DocMock);

        (hfComplete as jest.Mock).mockResolvedValue(JSON.stringify([
            {
                trend: "Test Trend",
                ideas: ["Idea 1", "Idea 2", "Idea 3"],
            },
        ]));

        const mockReqR1: any = {
            method: 'POST',
            body: { data: { runId } },
            headers: { origin: "*", 'content-type': 'application/json' },
            header: (key: string) => mockReqR1.headers[key.toLowerCase()],
        };
        const mockRes: any = {
            send: jest.fn(),
            status: jest.fn().mockReturnThis(),
            setHeader: jest.fn(),
            getHeader: jest.fn(),
            on: jest.fn(),
        };

        // Run Round 1
        await runRound1(mockReqR1, mockRes);

        // Check R1 artifact was written
        const r1DocMock = mockDocs.get(r1ArtifactPath);
        expect(r1DocMock).toBeDefined();
        expect(r1DocMock!.set).toHaveBeenCalledTimes(1);

        // Check R1 output data
        const r1Data = r1DocMock!.set.mock.calls[0][0];
        expect(r1Data).toHaveProperty("items");
        expect(r1Data.items.length).toBeGreaterThan(0);
        expect(r1Data.items[0]).toHaveProperty("trend");
        expect(r1Data.items[0]).toHaveProperty("idea");
    });
});
