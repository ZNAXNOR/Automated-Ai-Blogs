import { _test } from "../../../rounds/r5_relevance";
import fetch from "node-fetch";

const { Response } = jest.requireActual("node-fetch");

jest.mock("node-fetch", () => jest.fn());

// Mock Firestore
const setMock = jest.fn();
jest.mock("firebase-admin/firestore", () => ({
    getFirestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                set: setMock,
            })),
        })),
    })),
}));

describe("r5_relevance", () => {
  afterEach(() => {
    (fetch as unknown as jest.Mock).mockClear();
    setMock.mockClear();
  });

  describe("runR5Relevance", () => {
    it("should throw an error if draftId is missing", async () => {
      await expect(_test.runR5Relevance(null as any, "original", "polished")).rejects.toThrow(
        "Missing required fields: draftId, originalDraft, polishedText"
      );
    });

    it("should throw an error if originalDraft is missing", async () => {
        await expect(_test.runR5Relevance("testId", null as any, "polished")).rejects.toThrow(
          "Missing required fields: draftId, originalDraft, polishedText"
        );
    });

    it("should throw an error if polishedText is missing", async () => {
        await expect(_test.runR5Relevance("testId", "original", null as any)).rejects.toThrow(
            "Missing required fields: draftId, originalDraft, polishedText"
        );
    });

    it("should return relevance true", async () => {
      const draftId = "testId";
      const originalDraft = "original text";
      const polishedText = "polished text";

      const mockResponse = {
        isRelevant: true,
        reason: "The polished text successfully captures the essence of the original draft.",
      };

      (fetch as unknown as jest.Mock).mockResolvedValue(new Response(JSON.stringify([{ generated_text: JSON.stringify(mockResponse) }])));

      const result = await _test.runR5Relevance(draftId, originalDraft, polishedText);

      expect(result.draftId).toBe(draftId);
      expect(result.isRelevant).toBe(true);

      expect(setMock).toHaveBeenCalledTimes(1);
      const writtenData = setMock.mock.calls[0][0];
      expect(writtenData.draftId).toBe(draftId);
      expect(writtenData.isRelevant).toBe(true);
    });

    it("should return relevance false", async () => {
        const draftId = "testId";
        const originalDraft = "original text";
        const polishedText = "polished text";
  
        const mockResponse = {
          isRelevant: false,
          reason: "The polished text deviates significantly from the original draft.",
        };
  
        (fetch as unknown as jest.Mock).mockResolvedValue(new Response(JSON.stringify([{ generated_text: JSON.stringify(mockResponse) }])));
  
        const result = await _test.runR5Relevance(draftId, originalDraft, polishedText);
  
        expect(result.draftId).toBe(draftId);
        expect(result.isRelevant).toBe(false);
  
        expect(setMock).toHaveBeenCalledTimes(1);
        const writtenData = setMock.mock.calls[0][0];
        expect(writtenData.draftId).toBe(draftId);
        expect(writtenData.isRelevant).toBe(false);
      });

    it("should throw error for AI failure", async () => {
        (fetch as unknown as jest.Mock).mockResolvedValue(new Response(JSON.stringify([{ generated_text: "invalid json" }])));
        await expect(_test.runR5Relevance("id", "original", "polished")).rejects.toThrow();
    });

  });
});
