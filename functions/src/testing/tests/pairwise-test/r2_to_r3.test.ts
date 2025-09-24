import { Round3_Draft as runRound3 } from "../../../rounds/r3_draft";
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

jest.mock("../../../clients/hf");

const longDraft = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

describe("Pairwise: R2 -> R3", () => {
    const runId = "pairwise-test-r2-r3";

    beforeEach(() => {
        jest.clearAllMocks();
        mockDocs.clear();
    });

    test("R2 output feeds correctly into R3 draft generation", async () => {
        const r2ArtifactPath = `runs/${runId}/artifacts/round2_outlines`;
        const r3ArtifactPath = `runs/${runId}/artifacts/round3_drafts`;

        // Mock a valid R2 output according to r3_draft.ts's internal schema
        const r2Items = [
            {
                trend: "Sustainable Living",
                idea: "A Guide to Minimalist Travel",
                sections: [
                    { heading: "Introduction", bullets: ["The philosophy of minimalist travel"], estWordCount: 50 },
                    { heading: "Packing Light", bullets: ["Tips and tricks for a single bag"], estWordCount: 100 },
                    { heading: "Conclusion", bullets: ["The freedom of less"], estWordCount: 50 },
                ],
            },
            {
                trend: "AI in Art",
                idea: "The Rise of Generative Art",
                sections: [
                    { heading: "What is Generative Art?", bullets: ["A brief history"], estWordCount: 75 },
                    { heading: "Tools and Platforms", bullets: ["Midjourney, DALL-E 2, etc."], estWordCount: 125 },
                    { heading: "The Future of Creativity", bullets: ["Human-AI collaboration"], estWordCount: 100 },
                ],
            },
        ];
        const r2Data = { items: r2Items };
        const r2DocMock = {
            get: jest.fn().mockResolvedValue({ exists: true, data: () => r2Data }),
            set: jest.fn(),
        };
        mockDocs.set(r2ArtifactPath, r2DocMock);

        (hfComplete as jest.Mock).mockResolvedValue(longDraft);

        const mockReq: any = {
            method: 'POST',
            body: { data: { runId } },
            headers: { origin: "*", 'content-type': 'application/json' },
            header: (key: string) => mockReq.headers[key.toLowerCase()],
        };
        const mockRes: any = {
            send: jest.fn(),
            status: jest.fn().mockReturnThis(),
            setHeader: jest.fn(),
            getHeader: jest.fn(),
            on: jest.fn(),
        };

        // Run Round 3
        await runRound3(mockReq, mockRes);

        // 1. Check if the correct artifact was read
        expect(r2DocMock.get).toHaveBeenCalledTimes(1);

        // 2. Check if the output artifact was written correctly
        const r3DocMock = mockDocs.get(r3ArtifactPath);
        expect(r3DocMock).toBeDefined();
        expect(r3DocMock!.set).toHaveBeenCalledTimes(1);

        const writtenData = r3DocMock!.set.mock.calls[0][0];
        expect(writtenData).toHaveProperty("items");
        expect(Array.isArray(writtenData.items)).toBe(true);
        expect(writtenData.items.length).toBe(r2Items.length);

        // 3. Deep inspection of the written data
        for (let i = 0; i < writtenData.items.length; i++) {
            const item = writtenData.items[i];
            const sourceItem = r2Items[i];
            expect(item).toHaveProperty("idea", sourceItem.idea);
            expect(item).toHaveProperty("trend", sourceItem.trend);
            expect(item).toHaveProperty("draft");
            expect(item.draft).toBe(longDraft);
        }
    }, 15000);
});
