/**
 * Pairwise Chain Test: R2 → R3
 *
 * Ensures that the outline output of Round2 can be consumed by
 * Round3 Draft generation without schema mismatch or errors.
 */
import { Round3_Draft } from "../../../rounds/r3_draft";
import { R2OutlineItem } from "../../../rounds/r3_draft";
import fetch, { Response } from "node-fetch";

// Mock Firestore
const setMock = jest.fn();
const getMock = jest.fn();
const docMock = jest.fn((path: string) => ({
  get: getMock,
  set: setMock,
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({ doc: docMock })),
  FieldValue: {
    serverTimestamp: jest.fn(() => Date.now()), // Mock timestamp
  },
}));

// Mock node-fetch
jest.mock("node-fetch", () => jest.fn());
const mockedFetch = fetch as unknown as jest.MockedFunction<typeof fetch>;

describe("Pairwise: R2 -> R3", () => {
  const runId = "pairwise-test-r2-r3";

  beforeEach(() => {
    jest.clearAllMocks();
    // Set env vars for R3
    process.env.HUGGINGFACE_API_KEY_R3 = "test-key-r3";
    process.env.HUGGINGFACE_MODEL_R3 = "test-model-r3";
  });

  test(
    "R2 output feeds correctly into R3 draft generation",
    async () => {
      // 1. Mock R2 artifact read by R3
      const r2Outlines: R2OutlineItem[] = [
        {
          trend: "AI in content creation",
          idea: "Using AI to write blog posts",
          sections: [
            { heading: "Introduction", bullets: ["What is AI writing?"], estWordCount: 50 },
            { heading: "Conclusion", bullets: ["Summary of benefits"], estWordCount: 50 },
          ],
        },
        {
          trend: "Sustainable energy",
          idea: "The future of solar power",
          sections: [
            { heading: "The Basics", bullets: ["How solar panels work"], estWordCount: 100 },
          ],
        },
      ];
      getMock.mockResolvedValue({ exists: true, data: () => ({ items: r2Outlines }) });

      // 2. Mock R3 LLM call (Hugging Face)
      // Draft needs to be within the word count limits of R3 (250-2000 words)
      const mockDraftText = "word ".repeat(300).trim();
      const mockR3ApiResponse = {
        ok: true,
        status: 200,
        json: async () => [{ generated_text: mockDraftText }],
      } as Response;
      mockedFetch.mockResolvedValue(mockR3ApiResponse);

      // 3. Run Round 3
      await Round3_Draft(runId);

      // 4. Assertions

      // Check if the correct R2 artifact was read
      expect(docMock).toHaveBeenCalledWith(`runs/${runId}/artifacts/round2`);
      expect(getMock).toHaveBeenCalledTimes(1);

      // Check LLM calls for each outline
      expect(mockedFetch).toHaveBeenCalledTimes(r2Outlines.length);

      // Check if the R3 artifact was written correctly
      expect(docMock).toHaveBeenCalledWith(`runs/${runId}/artifacts/round3`);
      expect(setMock).toHaveBeenCalledTimes(1);

      // Deep inspection of the written data
      const writtenData = setMock.mock.calls[0][0];
      expect(writtenData).toHaveProperty("items");
      expect(Array.isArray(writtenData.items)).toBe(true);
      expect(writtenData.items.length).toBe(r2Outlines.length);

      for (const item of writtenData.items) {
        expect(item).toHaveProperty("runId", runId);
        expect(item).toHaveProperty("trend");
        expect(item).toHaveProperty("idea");
        expect(item).toHaveProperty("draft", mockDraftText);
        expect(item.wordCount).toBe(300);
        expect(item.metadata.createdAt).toBeGreaterThan(0);
        expect(item.metadata.retries).toBe(0);
      }
    },
    20000 // Increase timeout for potentially longer operation
  );
});
