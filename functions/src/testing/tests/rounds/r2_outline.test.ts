/**
 * Unit & Integration Tests for Round 2 (Outline Generation)
 */

import {
  Round2_Outline,
  fetchR1Data,
  saveR2Outlines,
  _test,
} from "../../../rounds/r2_outline";
import { IdeationItem } from "../../../utils/schema";
import fetch, { Response } from "node-fetch";

// --- MOCKS ---
const setMock = jest.fn();
const getMock = jest.fn();
const docMock = jest.fn(() => ({
  get: getMock,
  set: setMock,
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({ doc: docMock })),
}));

jest.mock("node-fetch", () => jest.fn());
const mockedFetch = fetch as unknown as jest.MockedFunction<typeof fetch>;

const { buildPrompt, extractJsonFromText, callHuggingFace, validateIdeationItems, validateOutlineSchema } = _test;

// --- TEST DATA ---
const RUN_ID = "test-run-r2";
const R1_ITEMS: IdeationItem[] = [
  { trend: "AI in healthcare", idea: "AI in hospitals", variant: 1, source: "llm" },
  { trend: "Budget smartphones", idea: "Top cheap phones", variant: 1, source: "llm" },
];

const LLM_RAW_OUTPUT = `
  Here is the JSON you requested:
  [
    {
      "trend": "AI in healthcare",
      "idea": "AI in hospitals",
      "sections": [
        { "heading": "Intro", "bullets": ["Point A"], "estWordCount": 50 },
        { "heading": "Conclusion", "bullets": ["Point B"], "estWordCount": 50 }
      ]
    },
    {
      "trend": "Budget smartphones",
      "idea": "Top cheap phones",
      "sections": [
        { "heading": "Intro", "bullets": ["C"], "estWordCount": 50 },
        { "heading": "Body", "bullets": ["D"], "estWordCount": 150 }
      ]
    }
  ]
  Hope you find it useful!
`;

const PARSED_OUTLINES = [
  {
    trend: "AI in healthcare",
    idea: "AI in hospitals",
    sections: [
      { heading: "Intro", bullets: ["Point A"], estWordCount: 50 },
      { heading: "Conclusion", bullets: ["Point B"], estWordCount: 50 },
    ],
  },
  {
    trend: "Budget smartphones",
    idea: "Top cheap phones",
    sections: [
      { heading: "Intro", bullets: ["C"], estWordCount: 50 },
      { heading: "Body", bullets: ["D"], estWordCount: 150 },
    ],
  },
];

// --- TESTS ---
describe("Round 2: Outline Generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HUGGINGFACE_API_KEY = "test-key";
    process.env.HUGGINGFACE_MODEL_R2 = "test-model-r2";
  });

  // 1. Test I/O Functions
  describe("I/O Operations", () => {
    it("fetchR1Data should retrieve and validate data", async () => {
      getMock.mockResolvedValue({ exists: true, data: () => ({ items: R1_ITEMS }) });
      const items = await fetchR1Data(RUN_ID);
      expect(docMock).toHaveBeenCalledWith(`runs/${RUN_ID}/artifacts/round1`);
      expect(getMock).toHaveBeenCalledTimes(1);
      expect(items).toEqual(R1_ITEMS);
    });

    it("fetchR1Data should throw if artifact not found", async () => {
      getMock.mockResolvedValue({ exists: false });
      await expect(fetchR1Data(RUN_ID)).rejects.toThrow(`R1 artifact not found for runId=${RUN_ID}`);
    });

    it("saveR2Outlines should write data to Firestore", async () => {
      await saveR2Outlines(RUN_ID, PARSED_OUTLINES);
      expect(docMock).toHaveBeenCalledWith(`runs/${RUN_ID}/artifacts/round2`);
      expect(setMock).toHaveBeenCalledWith({ items: PARSED_OUTLINES }, { merge: true });
    });
  });

  // 2. Test Utility Functions
  describe("Utility Functions", () => {
    it("buildPrompt should create a valid prompt", () => {
      const prompt = buildPrompt(R1_ITEMS);
      expect(prompt).toContain("AI in healthcare");
      expect(prompt).toContain("Top cheap phones");
      expect(prompt).toMatchSnapshot(); // Good for catching unintentional prompt changes
    });

    it("extractJsonFromText should get JSON from raw text", () => {
      const json = extractJsonFromText(LLM_RAW_OUTPUT);
      const expectedJson = JSON.stringify(PARSED_OUTLINES, null, 2).replace(/\n/g, '\n  ');
      //This is a bit of a hack to get the formatting to match the snapshot.

      expect(JSON.parse(json!)).toEqual(PARSED_OUTLINES);
    });

    it("extractJsonFromText should return null if no JSON is found", () => {
      expect(extractJsonFromText("No JSON here")).toBeNull();
    });
  });

  // 3. Test Validation Logic
  describe("Validation", () => {
    it("validateIdeationItems should pass valid items", () => {
      expect(() => validateIdeationItems(R1_ITEMS)).not.toThrow();
    });

    it("validateIdeationItems should throw on invalid items", () => {
      const invalidItems = [...R1_ITEMS, { trend: "Missing fields" }];
      expect(() => validateIdeationItems(invalidItems)).toThrow(/Invalid IdeationItem/);
    });

    it("validateOutlineSchema should pass valid outlines", () => {
      expect(() => validateOutlineSchema(PARSED_OUTLINES)).not.toThrow();
    });

    it("validateOutlineSchema should throw on invalid outlines", () => {
      const invalidOutlines = [...PARSED_OUTLINES, { trend: "Missing sections" }];
      expect(() => validateOutlineSchema(invalidOutlines)).toThrow(/Invalid outline format/);
    });
     it("validateOutlineSchema should throw on invalid sections", () => {
      const invalidSection = JSON.parse(JSON.stringify(PARSED_OUTLINES));
      invalidSection[0].sections.push({ heading: "No bullets" });
      expect(() => validateOutlineSchema(invalidSection)).toThrow(/Invalid section format/);
    });
  });


  // 4. Test API Call Logic
  describe("Hugging Face API Call", () => {
    it("callHuggingFace should return text on success", async () => {
      const mockResponse = {
        ok: true,
        json: async () => [{ generated_text: "Success!" }],
      } as Response;
      mockedFetch.mockResolvedValue(mockResponse);

      const result = await callHuggingFace("test prompt");
      expect(result).toBe("Success!");
    });

    it("callHuggingFace should throw on API error", async () => {
      const mockResponse = { ok: false, status: 500, statusText: "Server Error", text: async()=>"Error" } as Response;
      mockedFetch.mockResolvedValue(mockResponse);
      await expect(callHuggingFace("test prompt")).rejects.toThrow(/Hugging Face API Error/);
    });

     it("callHuggingFace should throw on invalid response structure", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ unexpected: "structure" }), // Malformed
      } as Response;
      mockedFetch.mockResolvedValue(mockResponse);
      await expect(callHuggingFace("test prompt")).rejects.toThrow(/Invalid or missing 'generated_text'/);
    });
  });


  // 5. Test Full Orchestration
  describe("Full Orchestration: Round2_Outline", () => {
    it("should execute the full round successfully", async () => {
      // Arrange
      getMock.mockResolvedValue({ exists: true, data: () => ({ items: R1_ITEMS }) });
      const mockResponse = {
        ok: true,
        json: async () => [{ generated_text: LLM_RAW_OUTPUT }],
      } as Response;
      mockedFetch.mockResolvedValue(mockResponse);

      // Act
      await Round2_Outline(RUN_ID);

      // Assert
      // 1. Fetched R1 data
      expect(docMock).toHaveBeenCalledWith(`runs/${RUN_ID}/artifacts/round1`);
      // 2. Called Hugging Face
      expect(mockedFetch).toHaveBeenCalledTimes(1);
      // 3. Saved R2 data
      expect(docMock).toHaveBeenCalledWith(`runs/${RUN_ID}/artifacts/round2`);
      expect(setMock).toHaveBeenCalledWith({ items: PARSED_OUTLINES }, { merge: true });
    });

     it("should retry on failed Hugging Face call", async () => {
      getMock.mockResolvedValue({ exists: true, data: () => ({ items: R1_ITEMS }) });

      const failureResponse = { ok: false, status: 504, statusText: "Gateway Timeout", text: async()=>"Timeout" } as Response;
      const successResponse = {
        ok: true,
        json: async () => [{ generated_text: LLM_RAW_OUTPUT }],
      } as Response;

      // Fail twice, then succeed
      mockedFetch.mockResolvedValueOnce(failureResponse).mockResolvedValueOnce(failureResponse).mockResolvedValueOnce(successResponse);

      await Round2_Outline(RUN_ID);

      expect(mockedFetch).toHaveBeenCalledTimes(3);
      expect(setMock).toHaveBeenCalledTimes(1); // Should still succeed
    });

  });
});
