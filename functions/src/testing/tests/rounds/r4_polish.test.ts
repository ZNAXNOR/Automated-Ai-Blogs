import { _test } from "../../../rounds/r4_polish";
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

describe("r4_polish", () => {
  afterEach(() => {
    (fetch as unknown as jest.Mock).mockClear();
    setMock.mockClear();
  });

  describe("runR4Polish", () => {
    it("should throw an error if draftId is missing", async () => {
      await expect(_test.runR4Polish(null as any, "test")).rejects.toThrow(
        "Missing required fields: draftId, draftText"
      );
    });

    it("should throw an error if draftText is missing", async () => {
      await expect(_test.runR4Polish("test", null as any)).rejects.toThrow(
        "Missing required fields: draftId, draftText"
      );
    });

    it("should return polished and derivatives", async () => {
      const draftId = "testId";
      const draftText = "test text";

      const mockResponse = {
        polished: `Polished: test text`,
        derivatives: [`Derivative 1: test text`, `Derivative 2: test text`],
      };

      (fetch as unknown as jest.Mock).mockResolvedValue(new Response(JSON.stringify([{ generated_text: JSON.stringify(mockResponse) }])));

      const result = await _test.runR4Polish(draftId, draftText);

      expect(result.draftId).toBe(draftId);
      expect(result.polished).toBe(mockResponse.polished);
      expect(result.derivatives).toEqual(mockResponse.derivatives);

      expect(setMock).toHaveBeenCalledTimes(1);
      const writtenData = setMock.mock.calls[0][0];
      expect(writtenData.draftId).toBe(draftId);
      expect(writtenData.polished).toBe(mockResponse.polished);
    });

    it("should throw error for empty polished text", async () => {
        const mockResponse = {
            polished: "",
            derivatives: ["d1", "d2"],
        };
        (fetch as unknown as jest.Mock).mockResolvedValue(new Response(JSON.stringify([{ generated_text: JSON.stringify(mockResponse) }])));
        await expect(_test.runR4Polish("id", "text")).rejects.toThrow("Polished text is empty");
    });

    it("should throw error for not enough derivatives", async () => {
        const mockResponse = {
            polished: "p1",
            derivatives: ["d1"],
        };
        (fetch as unknown as jest.Mock).mockResolvedValue(new Response(JSON.stringify([{ generated_text: JSON.stringify(mockResponse) }])));
        await expect(_test.runR4Polish("id", "text")).rejects.toThrow("Each draft must produce ≥ 2 derivative outputs");
    });

    it("should throw error for empty derivative", async () => {
        const mockResponse = {
            polished: "p1",
            derivatives: ["d1", " "],
        };
        (fetch as unknown as jest.Mock).mockResolvedValue(new Response(JSON.stringify([{ generated_text: JSON.stringify(mockResponse) }])));
        await expect(_test.runR4Polish("id", "text")).rejects.toThrow("Derivative output is empty");
    });
    
    it("should throw error for AI failure", async () => {
        (fetch as unknown as jest.Mock).mockResolvedValue(new Response(JSON.stringify([{ generated_text: "invalid json" }])));
        await expect(_test.runR4Polish("id", "text")).rejects.toThrow();
    });

  });
});
