import { Round2_Outline as runRound2 } from "../../../rounds/r2_outline";
import { hfComplete } from "../../../clients/hf";
import { IdeationItem } from "../../../utils/schema";

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

describe("Pairwise: R1 -> R2", () => {
    const runId = "pairwise-test-r1-r2";

    beforeEach(() => {
        jest.clearAllMocks();
        mockDocs.clear();
    });

    test("R1 output feeds correctly into R2 outlines", async () => {
        const r1ArtifactPath = `runs/${runId}/artifacts/round1_ideas`;
        const r2ArtifactPath = `runs/${runId}/artifacts/round2_outlines`;

        // Mock a valid R1 output
        const r1Items: IdeationItem[] = [
            {
                trend: "t1",
                idea: "A blog post about the impact of AI on SEO.",
                variant: 1,
                source: "llm",
            },
            {
                trend: "t2",
                idea: "A deep dive into the latest trends in functional programming.",
                variant: 1,
                source: "llm",
            },
        ];
        const r1Data = { items: r1Items };
        const r1DocMock = {
            get: jest.fn().mockResolvedValue({ exists: true, data: () => r1Data }),
            set: jest.fn(),
        };
        mockDocs.set(r1ArtifactPath, r1DocMock);

        // Mock the hfComplete function to return a valid outline
        (hfComplete as jest.Mock).mockResolvedValue(`
            [
              {
                "trend": "t1",
                "idea": "A blog post about the impact of AI on SEO.",
                "sections": [
                  {
                    "heading": "Introduction",
                    "bullets": [
                      "Brief overview of AI's growing role in SEO.",
                      "Thesis: AI is not just a tool, but a fundamental shift in SEO strategy."
                    ],
                    "estWordCount": 150
                  },
                  {
                    "heading": "Conclusion",
                    "bullets": [
                      "Recap of AI’s impact on SEO.",
                      "Future predictions for AI in search."
                    ],
                    "estWordCount": 200
                  }
                ]
              },
              {
                "trend": "t2",
                "idea": "A deep dive into the latest trends in functional programming.",
                "sections": [
                  {
                    "heading": "Introduction to Functional Programming",
                    "bullets": [
                      "What is functional programming?",
                      "Core concepts: immutability, first-class functions, etc."
                    ],
                    "estWordCount": 250
                  },
                  {
                    "heading": "Conclusion",
                    "bullets": [
                      "Summary of trends.",
                      "The future of functional programming."
                    ],
                    "estWordCount": 150
                  }
                ]
              }
            ]
        `);

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

        // Run Round 2
        await runRound2(mockReq, mockRes);

        // 1. Check if the correct artifact was read
        expect(r1DocMock.get).toHaveBeenCalledTimes(1);

        // 2. Check if the output artifact was written correctly
        const r2DocMock = mockDocs.get(r2ArtifactPath);
        expect(r2DocMock).toBeDefined();
        expect(r2DocMock!.set).toHaveBeenCalledTimes(1);

        const writtenData = r2DocMock!.set.mock.calls[0][0];
        expect(writtenData).toHaveProperty("items");
        expect(writtenData.items.length).toBe(r1Items.length);

        // 3. Deep inspection of the generated outlines
        for (let i = 0; i < r1Items.length; i++) {
            const outline = writtenData.items[i];
            expect(outline).toHaveProperty("idea", r1Items[i].idea);
            expect(outline).toHaveProperty("trend", r1Items[i].trend);
            expect(outline).toHaveProperty("sections");
            expect(outline.sections.length).toBeGreaterThan(0);
        }
    });
});
