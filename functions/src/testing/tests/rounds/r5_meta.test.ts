const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDoc = jest.fn((path) => ({ get: mockGet, set: mockSet, path }));
const mockBatchCommit = jest.fn();
const mockBatchSet = jest.fn();
const mockBatch = jest.fn(() => ({
  commit: mockBatchCommit,
  set: mockBatchSet,
}));

jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    () => ({
      doc: mockDoc,
      batch: mockBatch,
    }),
    {
      FieldValue: {
        serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP"),
      },
    }
  ),
}));

// Mock the correct Hugging Face client
jest.mock("../../../clients/hf", () => ({
  __esModule: true,
  hfComplete: jest.fn(),
  extractJsonFromText: jest.fn(),
}));

import { run } from "../../../rounds/r5_meta";
import * as hf from "../../../clients/hf"; // Import the mocked client
import { HttpsError } from "firebase-functions/v2/https";
import { ARTIFACT_PATHS } from "../../../utils/constants";

// Use the mocked Hugging Face functions
const mockHfComplete = hf.hfComplete as jest.Mock;
const mockExtractJson = hf.extractJsonFromText as jest.Mock;

const RUN_ID = "test-run-meta-123";

const MOCK_R4_DATA = {
  items: [
    {
      idea: "The Art of Prompt Engineering",
      polishedDraft: "The quick brown fox jumps over the lazy dog. ".repeat(20),
    },
    {
      idea: "The History of AI",
      polishedDraft: "The lazy dog was jumped over by the quick brown fox. ".repeat(20),
    },
  ],
};

const VALID_LLM_OUTPUT = {
  seoTitle: "Mastering the Art of Prompt Engineering for Better AI",
  metaDescription: "Learn how to craft effective prompts to get the best results from your AI models. This guide covers the essentials of prompt engineering.",
  tags: ["AI", "Prompt Engineering", "LLM", "Artificial Intelligence"],
  categories: ["Technology"],
  excerpt: "This comprehensive guide delves into the art and science of prompt engineering. We will explore various techniques and best practices to help you communicate effectively with large language models and achieve your desired outcomes. From simple instructions to complex, multi-shot prompts, you'll learn how to refine your inputs for maximum impact and accuracy in AI-driven content generation and analysis.",
  relatedKeywords: ["AI prompt guide", "large language models", "GPT-4 tips"],
  imageSuggestions: ["[image: a brain with a gear in it, representing AI thought]", "[image: a person talking to a robot across a desk]"],
};

describe("runR5_Meta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true, data: () => MOCK_R4_DATA });
    mockExtractJson.mockImplementation((text) => text);
  });

  it("should process all drafts and generate metadata successfully", async () => {
    mockHfComplete.mockResolvedValue(JSON.stringify(VALID_LLM_OUTPUT));

    const result = await run({ runId: RUN_ID });

    expect(result).toEqual({ metaCount: 2, failures: 0 });
    expect(mockHfComplete).toHaveBeenCalledTimes(2); // Check the correct mock
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);

    const successPath = ARTIFACT_PATHS.R5_META.replace("{runId}", RUN_ID);
    const writtenData = mockBatchSet.mock.calls[0][1];
    expect(mockDoc).toHaveBeenCalledWith(successPath);
    expect(writtenData.items).toHaveLength(2);
    expect(writtenData.items[0].idea).toBe("The Art of Prompt Engineering");
    expect(writtenData.items[0].meta.tags).toEqual(["AI", "Prompt Engineering", "LLM", "Artificial Intelligence"]);
  });

  it("should handle a mix of successful and failed metadata generations", async () => {
    mockHfComplete
      .mockResolvedValueOnce(JSON.stringify(VALID_LLM_OUTPUT))
      .mockRejectedValueOnce(new Error("LLM is having a moment"))
      .mockRejectedValueOnce(new Error("LLM is still having a moment"))
      .mockRejectedValueOnce(new Error("LLM has given up"));

    const result = await run({ runId: RUN_ID });

    expect(result).toEqual({ metaCount: 1, failures: 1 });
    expect(mockHfComplete).toHaveBeenCalledTimes(4); // 1 success, 1 fail, 2 retries
    expect(mockBatchSet).toHaveBeenCalledTimes(1); // Only writes success artifact
  });

  it("should throw not-found if the R4 artifact does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });

    await expect(run({ runId: RUN_ID })).rejects.toThrow(
      new HttpsError("not-found", `Round 4 artifact not found for runId=${RUN_ID}`)
    );
  });

  it("should fail a draft that is too short", async () => {
    const shortDraftData = {
      items: [
        { idea: "Too Short", polishedDraft: "This is too short." },
        { ...MOCK_R4_DATA.items[1] },
      ],
    };
    mockGet.mockResolvedValue({ exists: true, data: () => shortDraftData });
    mockHfComplete.mockResolvedValue(JSON.stringify(VALID_LLM_OUTPUT));

    const result = await run({ runId: RUN_ID });

    expect(result).toEqual({ metaCount: 1, failures: 1 });
    expect(mockHfComplete).toHaveBeenCalledTimes(1); // Only called for the valid draft
  });

  it("should handle failure to parse JSON from LLM", async () => {
    mockExtractJson.mockReturnValue(null);
    mockHfComplete.mockResolvedValue("this is not json");

    const result = await run({ runId: RUN_ID });

    expect(result).toEqual({ metaCount: 0, failures: 2 });
  });
});
