import { _test } from "../../../rounds/r6_coherence";
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

describe("r6_coherence", () => {
  afterEach(() => {
    (fetch as unknown as jest.Mock).mockClear();
    setMock.mockClear();
  });

  describe("runR6Coherence", () => {
    it("should throw an error if draftId is missing", async () => {
      await expect(_test.runR6Coherence(null as any, "polished", ["d1"])).rejects.toThrow(
        "Missing required fields: draftId, polishedText, derivatives"
      );
    });

    it("should throw an error if polishedText is missing", async () => {
        await expect(_test.runR6Coherence("testId", null as any, ["d1"])).rejects.toThrow(
          "Missing required fields: draftId, polishedText, derivatives"
        );
    });

    it("should throw an error if derivatives are missing", async () => {
        await expect(_test.runR6Coherence("testId", "polished", null as any)).rejects.toThrow(
            "Missing required fields: draftId, polishedText, derivatives"
        );
    });

    it("should return coherence score", async () => {
      const draftId = "testId";
      const polishedText = "polished text";
      const derivatives = ["derivative 1", "derivative 2"];

      const mockResponse = [0.8, 0.9];

      (fetch as unknown as jest.Mock).mockResolvedValue(new Response(JSON.stringify(mockResponse)));

      const result = await _test.runR6Coherence(draftId, polishedText, derivatives);

      expect(result.draftId).toBe(draftId);
      expect(result.coherenceScore).toBeCloseTo(0.85);

      expect(setMock).toHaveBeenCalledTimes(1);
      const writtenData = setMock.mock.calls[0][0];
      expect(writtenData.draftId).toBe(draftId);
      expect(writtenData.coherenceScore).toBeCloseTo(0.85);
    });

    it("should throw error for AI failure", async () => {
        (fetch as unknown as jest.Mock).mockRejectedValue(new Error("HF API error: 500 Internal Server Error"));
        await expect(_test.runR6Coherence("id", "polished", ["d1"])).rejects.toThrow("HF API error: 500 Internal Server Error");
    });

  });
});
