import { runRound6 } from "../../../rounds/r6_coherence";
import admin from "firebase-admin";

// Hoisted mock variable for LLM client
let mockGenerate: jest.Mock;

// Hoisted mock variables for Firestore
const firestoreGetMock = jest.fn();
const firestoreSetMock = jest.fn();

// Mock Firebase Admin SDK
jest.mock("firebase-admin", () => ({
  apps: [{}], // Mock app initialization to prevent errors
  initializeApp: jest.fn(),
  firestore: () => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: firestoreGetMock,
        set: firestoreSetMock,
      })),
    })),
  }),
}));

// Mock LLMClient using a factory to handle hoisting
jest.mock("../../../utils/llmClient", () => ({
  LLMClient: jest.fn().mockImplementation(() => {
    // This function will be called when new LLMClient() is executed in the code under test
    // It returns an object with a `generate` method that calls our hoisted mock.
    return {
      generate: (...args: any[]) => mockGenerate(...args),
    };
  }),
}));

describe("Round 6 — Coherence & Duplication Checks", () => {
  const trendId = "test-trend";

  beforeEach(() => {
    // Reset all mocks before each test to ensure isolation
    jest.clearAllMocks();
    mockGenerate = jest.fn();
    firestoreGetMock.mockClear();
    firestoreSetMock.mockClear();

    // Default mock for LLM response
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        validatedText:
          "This is a test blog draft. It has coherent flow. This is a good test blog draft.",
        issuesFound: ["Removed duplicate sentence."],
        coherenceScore: 0.9,
        metadataAlignment: true,
      }),
    });

    // Default mock for Firestore get response
    firestoreGetMock.mockResolvedValue({
      exists: true,
      data: () => ({
        draftText:
          "This is a test blog draft. It has coherent flow. This is a test blog draft.",
        metadata: {
          title: "Test Draft",
          description: "Testing coherence and metadata alignment",
          tags: ["test", "blog", "draft"],
          imagePrompts: [],
        },
      }),
    });
  });

  it("should produce a valid coherence object", async () => {
    const result = await runRound6(trendId);

    expect(result.validatedText).toBeTruthy();
    expect(result.coherenceScore).toBeGreaterThanOrEqual(0);
    expect(result.coherenceScore).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.issuesFound)).toBe(true);
    expect(firestoreSetMock).toHaveBeenCalled();
  });

  it("should ensure validatedText is at least 90% of original", async () => {
    const result = await runRound6(trendId);
    const originalText =
      "This is a test blog draft. It has coherent flow. This is a test blog draft.";

    expect(result.validatedText.length).toBeGreaterThanOrEqual(
      originalText.length * 0.9
    );
  });

  it("should set metadataAlignment false if tags are missing", async () => {
    // Override Firestore get mock for this specific test
    firestoreGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        draftText: "This draft does not mention required tags.",
        metadata: { tags: ["coherence-check"] },
      }),
    });

    // Override LLM mock for this specific test
    mockGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        validatedText: "This draft does not mention required tags.",
        issuesFound: ["Metadata tags not found in text."],
        coherenceScore: 0.8,
        metadataAlignment: false,
      }),
    });

    const result = await runRound6(trendId);
    expect(result.metadataAlignment).toBe(false);
  });

  it("should not contain duplicate sentences in validatedText", async () => {
    const result = await runRound6(trendId);
    const sentences = result.validatedText.split(/[.!?]\s/);
    const unique = new Set(sentences);
    expect(unique.size).toBe(sentences.length);
  });
});
