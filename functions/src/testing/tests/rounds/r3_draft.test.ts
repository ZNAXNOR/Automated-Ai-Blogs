/**
 * Unit & Integration Tests for Round 3 (Draft Generation)
 */

import {
  Round3_Draft,
  fetchR2Data,
  saveR3Drafts,
  _test,
  R2OutlineItem,
} from "../../../rounds/r3_draft";
import fetch, { Response } from "node-fetch";

// --- MOCKS ---
const setMock = jest.fn();
const getMock = jest.fn();
const docMock = jest.fn(() => ({ get: getMock, set: setMock }));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({ doc: docMock })),
  FieldValue: {
    serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP"),
  },
}));

jest.mock("node-fetch", () => jest.fn());
const mockedFetch = fetch as unknown as jest.MockedFunction<typeof fetch>;

const { buildPrompt, convertOutlineToString, generateDraftForOutline, sanitizeDraft, validateR2Outlines, wordCount } = _test;

// --- TEST DATA ---
const RUN_ID = "test-run-r3";
const VALID_OUTLINES: R2OutlineItem[] = [
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

// Generates a mock draft string of a specific word count
const mockDraftGenerator = (wordCt: number) => `word `.repeat(wordCt).trim();
const DRAFT_WITH_VALID_WORD_COUNT = mockDraftGenerator(300);

// --- TESTS ---
describe("Round 3: Draft Generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HUGGINGFACE_API_KEY_R3 = "test-key-r3";
    process.env.HUGGINGFACE_MODEL_R3 = "test-model-r3";
  });

  // 1. Test I/O
  describe("I/O Operations", () => {
    it("fetchR2Data should retrieve and validate data", async () => {
      getMock.mockResolvedValue({ exists: true, data: () => ({ items: VALID_OUTLINES }) });
      const items = await fetchR2Data(RUN_ID);
      expect(docMock).toHaveBeenCalledWith(`runs/${RUN_ID}/artifacts/round2`);
      expect(items).toEqual(VALID_OUTLINES);
    });

    it("saveR3Drafts should write an array of drafts", async () => {
      const mockDrafts = [ { draft: "Test draft", metadata: {} } ] as any;
      await saveR3Drafts(RUN_ID, mockDrafts);
      expect(docMock).toHaveBeenCalledWith(`runs/${RUN_ID}/artifacts/round3`);
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ items: mockDrafts }));
    });
  });

  // 2. Test Utilities
  describe("Utility Functions", () => {
    it("wordCount should count words correctly", () => {
      expect(wordCount("one two three")).toBe(3);
      expect(wordCount("  leading and trailing spaces  ")).toBe(4);
      expect(wordCount("")).toBe(0);
      expect(wordCount("\n\twhitespaces\r")).toBe(1);
    });

    it("convertOutlineToString should format the outline correctly", () => {
      const outlineString = convertOutlineToString(VALID_OUTLINES[0]);
      expect(outlineString).toContain("## Introduction");
      expect(outlineString).toContain("- What is AI writing?");
      expect(outlineString).toMatchSnapshot();
    });

    it("sanitizeDraft should remove the prompt if present", () => {
      const prompt = "PROMPT: Write an article.";
      const response = "PROMPT: Write an article. Here is the article.";
      expect(sanitizeDraft(response, prompt)).toBe("Here is the article.");
      expect(sanitizeDraft("Just the article", prompt)).toBe("Just the article");
    });
  });

  // 3. Test Validation
  describe("Validation", () => {
    it("validateR2Outlines should pass valid outlines", () => {
      expect(() => validateR2Outlines(VALID_OUTLINES)).not.toThrow();
    });

    it("validateR2Outlines should throw on missing sections", () => {
      const invalid = [{ ...VALID_OUTLINES[0], sections: [] }];
      expect(() => validateR2Outlines(invalid)).toThrow(/missing fields or empty sections/);
    });

    it("validateR2Outlines should throw on malformed section", () => {
      const invalid = JSON.parse(JSON.stringify(VALID_OUTLINES)); // deep copy
      invalid[0].sections[0] = { heading: "no bullets" };
      expect(() => validateR2Outlines(invalid)).toThrow(/Invalid section/);
    });
  });

  // 4. Test Core Logic
  describe("generateDraftForOutline (Core Logic)", () => {
    it("should generate a valid draft on the first attempt", async () => {
      const mockGenerator = jest.fn().mockResolvedValue(DRAFT_WITH_VALID_WORD_COUNT);
      const result = await generateDraftForOutline(VALID_OUTLINES[0], RUN_ID, mockGenerator);

      expect(mockGenerator).toHaveBeenCalledTimes(1);
      expect(result.wordCount).toBe(300);
      expect(result.draft).toBe(DRAFT_WITH_VALID_WORD_COUNT);
      expect(result.metadata.retries).toBe(0);
    });

    it("should retry until word count is met", async () => {
      const draftTooShort = mockDraftGenerator(50);
      const draftTooLong = mockDraftGenerator(2500);
      const validDraft = mockDraftGenerator(400);

      const mockGenerator = jest.fn()
        .mockResolvedValueOnce(draftTooShort)
        .mockResolvedValueOnce(draftTooLong)
        .mockResolvedValueOnce(validDraft);

      const result = await generateDraftForOutline(VALID_OUTLINES[0], RUN_ID, mockGenerator);

      expect(mockGenerator).toHaveBeenCalledTimes(3);
      expect(result.wordCount).toBe(400);
      expect(result.metadata.retries).toBe(2);
    });

    it("should throw an error after all retries fail", async () => {
      const draftTooShort = mockDraftGenerator(50);
      const mockGenerator = jest.fn().mockResolvedValue(draftTooShort);

      await expect(
        generateDraftForOutline(VALID_OUTLINES[0], RUN_ID, mockGenerator)
      ).rejects.toThrow(/Generated draft word count .* is outside the range/);
      expect(mockGenerator).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  // 5. Test Full Orchestration
  describe("Full Orchestration: Round3_Draft", () => {
    it("should process multiple outlines in parallel and save successful drafts", async () => {
      // Arrange: Mock Firestore fetch
      getMock.mockResolvedValue({ exists: true, data: () => ({ items: VALID_OUTLINES }) });

      // Arrange: Mock the LLM call
      mockedFetch.mockResolvedValue({
        ok: true,
        json: async () => [{ generated_text: DRAFT_WITH_VALID_WORD_COUNT }],
      } as Response);

      // Act
      const { draftsCreated, failures } = await Round3_Draft(RUN_ID);

      // Assert
      expect(draftsCreated).toBe(2);
      expect(failures).toBe(0);

      // Verify LLM was called for each outline
      expect(mockedFetch).toHaveBeenCalledTimes(2);

      // Verify data was saved correctly
      expect(setMock).toHaveBeenCalledTimes(1);
      const savedData = setMock.mock.calls[0][0];
      expect(savedData.items.length).toBe(2);
      expect(savedData.items[0].wordCount).toBe(300);
      expect(savedData.items[1].trend).toBe("Sustainable energy");
    });

    it("should handle failures gracefully and save only successful drafts", async () => {
      // Arrange: Mock Firestore fetch
      getMock.mockResolvedValue({ exists: true, data: () => ({ items: VALID_OUTLINES }) });

      // Arrange: One success, one failure
      const draftTooShort = mockDraftGenerator(20);
      const successResponse = {
        ok: true,
        json: async () => [{ generated_text: DRAFT_WITH_VALID_WORD_COUNT }],
      } as Response;
      const failureResponse = {
        ok: true, // API call succeeds, but content is bad
        json: async () => [{ generated_text: draftTooShort }],
      } as Response;

      mockedFetch.mockResolvedValueOnce(successResponse).mockResolvedValue(failureResponse);

      // Act
      const { draftsCreated, failures } = await Round3_Draft(RUN_ID);

      // Assert
      expect(draftsCreated).toBe(1);
      expect(failures).toBe(1);

      // Verify save was called with only the one successful draft
      expect(setMock).toHaveBeenCalledTimes(1);
      const savedData = setMock.mock.calls[0][0];
      expect(savedData.items.length).toBe(1);
      expect(savedData.items[0].trend).toBe("AI in content creation");
    });
  });
});
