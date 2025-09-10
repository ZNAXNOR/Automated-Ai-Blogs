import { _test } from "../../src/rounds/r4_polish";

// Mock Google AI plugin
jest.mock("@genkit-ai/googleai", () => ({
  googleAI: jest.fn(),
}));

// A var is used here to get around Jest's hoisting and the Temporal Dead Zone.
// This allows the mockGenerate variable to be assigned from within the jest.mock factory.
var mockGenerate: jest.Mock;

jest.mock("genkit", () => {
  const originalGenkit = jest.requireActual("genkit");
  const mg = jest.fn();
  mockGenerate = mg;
  return {
    ...originalGenkit,
    genkit: jest.fn(() => ({
      generate: mg,
    })),
  };
});

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
    mockGenerate.mockClear();
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
      const prompt = _test.buildPrompt(draftText);

      mockGenerate.mockResolvedValue({
          output: {
            polished: `Polished: ${prompt}`,
            derivatives: [`Derivative 1: ${prompt}`, `Derivative 2: ${prompt}`],
          },
      });

      const result = await _test.runR4Polish(draftId, draftText);

      expect(result.draftId).toBe(draftId);
      expect(result.polished).toBe(`Polished: ${prompt}`);
      expect(result.derivatives).toEqual([`Derivative 1: ${prompt}`, `Derivative 2: ${prompt}`]);

      expect(setMock).toHaveBeenCalledTimes(1);
      const writtenData = setMock.mock.calls[0][0];
      expect(writtenData.draftId).toBe(draftId);
      expect(writtenData.polished).toBe(`Polished: ${prompt}`);
    });

    it("should throw error for empty polished text", async () => {
        mockGenerate.mockResolvedValue({
            output: {
                polished: "",
                derivatives: ["d1", "d2"],
            },
        });
        await expect(_test.runR4Polish("id", "text")).rejects.toThrow("Polished text is empty");
    });

    it("should throw error for not enough derivatives", async () => {
        mockGenerate.mockResolvedValue({
            output: {
                polished: "p1",
                derivatives: ["d1"],
            },
        });
        await expect(_test.runR4Polish("id", "text")).rejects.toThrow("Each draft must produce ≥ 2 derivative outputs");
    });

    it("should throw error for empty derivative", async () => {
        mockGenerate.mockResolvedValue({
            output: {
                polished: "p1",
                derivatives: ["d1", " "],
            },
        });
        await expect(_test.runR4Polish("id", "text")).rejects.toThrow("Derivative output is empty");
    });
    
    it("should throw error for AI failure", async () => {
        mockGenerate.mockResolvedValue({
            output: null,
        });
        await expect(_test.runR4Polish("id", "text")).rejects.toThrow("AI failed to generate a response");
    });

  });
});
