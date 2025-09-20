import { _test, R3DraftDocument } from "../../../rounds/r4_polish";

// Mock the llmApiCall function
const mockLlmApiCall = jest.fn();

describe("r4_polish", () => {
  afterEach(() => {
    mockLlmApiCall.mockClear();
  });

  describe("processSingleDraft", () => {
    const mockDraft: R3DraftDocument = {
      runId: "test-run",
      trend: "test-trend",
      idea: "test-idea",
      draft: "This is a test draft.",
      wordCount: 5,
    };

    it("should return polished and derivatives for a valid response", async () => {
      const mockLlmResponse = {
        polished: "This is a polished test draft that is long enough.",
        derivatives: ["A tweet.", "A LinkedIn post."],
      };
      mockLlmApiCall.mockResolvedValue(JSON.stringify(mockLlmResponse));

      const result = await _test.processSingleDraft(mockDraft, mockLlmApiCall);

      expect(mockLlmApiCall).toHaveBeenCalledTimes(1);
      expect(result.polished).toBe(mockLlmResponse.polished);
      expect(result.derivatives).toEqual(mockLlmResponse.derivatives);
      expect(result.originalDraft).toBe(mockDraft.draft);
      expect(result.metadata.originalWordCount).toBe(5);
      expect(result.metadata.polishedWordCount).toBe(10); 
    });

    it("should throw an error for empty polished text", async () => {
      const mockLlmResponse = {
        polished: "",
        derivatives: ["d1", "d2"],
      };
      mockLlmApiCall.mockResolvedValue(JSON.stringify(mockLlmResponse));

      await expect(_test.processSingleDraft(mockDraft, mockLlmApiCall)).rejects.toThrow(
        "LLM response validation failed: 'polished' is not a string or is too short"
      );
    });

    it("should throw an error for not enough derivatives", async () => {
      const mockLlmResponse = {
        polished: "This is a polished test draft that is long enough.",
        derivatives: ["d1"],
      };
      mockLlmApiCall.mockResolvedValue(JSON.stringify(mockLlmResponse));

      await expect(_test.processSingleDraft(mockDraft, mockLlmApiCall)).rejects.toThrow(
        "LLM response validation failed: 'derivatives' must be an array with at least 2 items"
      );
    });

    it("should throw an error for an empty derivative", async () => {
        const mockLlmResponse = {
            polished: "This is a polished test draft that is long enough.",
            derivatives: ["d1", " "],
        };
        mockLlmApiCall.mockResolvedValue(JSON.stringify(mockLlmResponse));

        await expect(_test.processSingleDraft(mockDraft, mockLlmApiCall)).rejects.toThrow(
            "LLM response validation failed: a derivative is not a non-empty string"
        );
    });

    it("should throw an error if the LLM response is not valid JSON", async () => {
      mockLlmApiCall.mockResolvedValue("this is not json");

      await expect(_test.processSingleDraft(mockDraft, mockLlmApiCall)).rejects.toThrow(
        "No valid JSON object found in LLM response."
      );
    });

    it("should retry on LLM failure", async () => {
        mockLlmApiCall.mockRejectedValueOnce(new Error("LLM Error"));
        const mockLlmResponse = {
            polished: "This is a polished test draft that is long enough.",
            derivatives: ["A tweet.", "A LinkedIn post."],
        };
        mockLlmApiCall.mockResolvedValueOnce(JSON.stringify(mockLlmResponse));

        const result = await _test.processSingleDraft(mockDraft, mockLlmApiCall);
        expect(mockLlmApiCall).toHaveBeenCalledTimes(2);
        expect(result.polished).toBe(mockLlmResponse.polished);
    });

    it("should fail after all retries", async () => {
        mockLlmApiCall.mockRejectedValue(new Error("LLM Error"));
        await expect(_test.processSingleDraft(mockDraft, mockLlmApiCall)).rejects.toThrow(
            "LLM call failed after 2 retries: LLM Error"
        );
        expect(mockLlmApiCall).toHaveBeenCalledTimes(3); 
    });
  });

  describe("extractJsonFromText", () => {
      it("should extract JSON from a markdown code block", () => {
          const text = "Some text before\n```json\n{\"key\": \"value\"}\n```\nSome text after";
          const result = _test.extractJsonFromText(text);
          expect(result).toBe('{\"key\": \"value\"}');
      });

      it("should extract a standalone JSON object", () => {
          const text = "Some text and then {\"key\": \"value\"} and more text.";
          const result = _test.extractJsonFromText(text);
          expect(result).toBe('{\"key\": \"value\"}');
      });

      it("should return null if no JSON is found", () => {
          const text = "This is a string with no JSON.";
          const result = _test.extractJsonFromText(text);
          expect(result).toBeNull();
      });
  })
});