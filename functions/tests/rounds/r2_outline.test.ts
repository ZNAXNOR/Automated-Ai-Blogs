/**
 * Jest tests for Round 2 - Outline Generation
 */

import { runRound2Outline, OutlineItem, _test } from "@src/rounds/r2_outline";
import { IdeationItem } from "@src/rounds/r1_ideate";
import fetch from "node-fetch";

const mockFirestoreStore: Record<string, any> = {};

// --- Firestore Mock ---
jest.mock("firebase-admin/firestore", () => {
  return {
    getFirestore: () => ({
      doc: (path: string) => ({
        get: async () => ({
          exists: !!mockFirestoreStore[path],
          data: () => mockFirestoreStore[path],
        }),
        set: async (val: any) => {
          mockFirestoreStore[path] = val;
        },
      }),
    }),
  };
});

// --- Fetch Mock ---
jest.mock("node-fetch", () => jest.fn());

const mockedFetch = fetch as jest.Mock;

beforeEach(() => {
  Object.keys(mockFirestoreStore).forEach((k) => delete mockFirestoreStore[k]);
  mockedFetch.mockReset();

  // Default Round 1 artifact
  mockFirestoreStore["runs/testRun/artifacts/round1"] = {
    items: [
      {
        trend: "AI in healthcare",
        idea: "How AI is Transforming Healthcare in 2025",
        variant: 0,
        source: "llm",
      },
    ],
  };

  // Default LLM response
  mockedFetch.mockResolvedValue({
    ok: true,
    json: async () => [
      {
        generated_text: JSON.stringify([
          {
            trend: "AI in healthcare",
            idea: "How AI is Transforming Healthcare in 2025",
            sections: [
              {
                heading: "Introduction",
                bullets: ["Overview of AI adoption", "Why 2025 matters"],
                estWordCount: 100,
              },
              {
                heading: "AI in Diagnostics",
                bullets: ["Medical imaging improvements", "AI-based pathology"],
                estWordCount: 120,
              },
              {
                heading: "Conclusion",
                bullets: ["Summarize benefits", "Future outlook"],
                estWordCount: 90,
              },
            ],
          },
        ]),
      },
    ],
  });
});

describe("Round2 Outline Generation", () => {
  test("produces valid outlines and saves to Firestore", async () => {
    const outlines: OutlineItem[] = await runRound2Outline("testRun");

    expect(outlines.length).toBe(1);
    const outline = outlines[0];

    expect(outline.trend).toBe("AI in healthcare");
    expect(outline.idea).toBe("How AI is Transforming Healthcare in 2025");

    // Must have >= 3 sections
    expect(outline.sections.length).toBeGreaterThanOrEqual(3);

    for (const section of outline.sections) {
      expect(section.heading).toBeTruthy();
      expect(section.bullets.length).toBeGreaterThanOrEqual(2);
      expect(section.estWordCount).toBeGreaterThan(0);
    }

    // Firestore write should succeed
    expect(mockFirestoreStore["runs/testRun/artifacts/round2"].items).toBeDefined();
  });

  test("throws error if Round1 artifact is missing", async () => {
    delete mockFirestoreStore["runs/testRun/artifacts/round1"];

    await expect(runRound2Outline("testRun")).rejects.toThrow(
      /Round1 artifact not found/
    );
  });

  test("throws error if Round1 items are empty", async () => {
    mockFirestoreStore["runs/testRun/artifacts/round1"] = { items: [] };

    await expect(runRound2Outline("testRun")).rejects.toThrow(/No ideas found/);
  });

  test("throws error if model returns invalid JSON", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ generated_text: "NOT JSON" }],
    });

    await expect(runRound2Outline("testRun")).rejects.toThrow();
  });

  test("buildPrompt includes all R1 ideas", () => {
    const ideas: IdeationItem[] = [
      { trend: "AI in healthcare", idea: "AI saves lives", variant: 0, source: "llm" },
      { trend: "Green tech", idea: "Solar energy growth", variant: 0, source: "llm" },
    ];

    const prompt = _test.buildPrompt(ideas);
    expect(prompt).toContain("AI saves lives");
    expect(prompt).toContain("Solar energy growth");
  });
});
