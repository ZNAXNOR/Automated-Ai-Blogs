import { Round4_Polish } from "../../../rounds/r4_polish";
import { DraftItem, PolishedDraftItem } from "../../../utils/schema";
import { ResponseWrapper } from "../../../utils/responseHelper";
import admin from "firebase-admin";

// Mock dependencies
const mockLlmApiCall = jest.fn();
jest.mock("p-limit", () => {
  const limit = (fn: any) => fn();
  return () => limit;
});

jest.mock("node-fetch", () => jest.fn());

describe("Round4_Polish", () => {
  const RUN_ID = "test-run-r4";
  const MOCK_DRAFTS: DraftItem[] = [
    {
      idea: "Test Idea 1",
      draft: "This is the first draft.",
    },
    {
      idea: "Test Idea 2",
      draft: "This is the second draft, which is much longer and more detailed.",
    },
  ];

  const MOCK_LLM_RESPONSE = {
    polished: "This is a beautifully polished version of the draft.",
    derivatives: ["Tweet: A polished draft is here!", "Email: Check out this great new article."],
  };

  let firestoreMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const llmResponseWrapper = {
      json: jest.fn().mockResolvedValue(MOCK_LLM_RESPONSE),
    } as unknown as ResponseWrapper;

    mockLlmApiCall.mockResolvedValue(llmResponseWrapper);

    // --- Firestore Mock ---
    const setMock = jest.fn();
    const getMock = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ items: MOCK_DRAFTS }),
    });
    const docMock = jest.fn((path) => ({
      get: getMock,
      set: setMock,
      path,
    }));
    const collectionMock = jest.fn((path) => ({
      doc: docMock,
      path,
    }));
    const batchSetMock = jest.fn();
    const batchCommitMock = jest.fn().mockResolvedValue(undefined);
    const batchMock = jest.fn(() => ({
      set: batchSetMock,
      commit: batchCommitMock,
    }));

    firestoreMock = {
      collection: collectionMock,
      doc: docMock,
      batch: batchMock,
    };

    Object.defineProperty(admin, "firestore", {
      get: () => (() => firestoreMock) as any,
      configurable: true,
    });
    // --- End Firestore Mock ---
  });

  it("should process drafts and save polished versions successfully", async () => {
    const { polishedCount, failures } = await Round4_Polish(RUN_ID, {
      llmApiCall: mockLlmApiCall,
      firestore: firestoreMock,
    });

    expect(polishedCount).toBe(MOCK_DRAFTS.length);
    expect(failures).toBe(0);
    expect(mockLlmApiCall).toHaveBeenCalledTimes(MOCK_DRAFTS.length);
    expect(firestoreMock.batch().set).toHaveBeenCalledTimes(1);
    expect(firestoreMock.batch().commit).toHaveBeenCalledTimes(1);
  });

  it("should handle a mix of successful and failed polishing attempts", async () => {
    const error = new Error("LLM call timed out");
    const llmSuccessResponse = {
        json: jest.fn().mockResolvedValue(MOCK_LLM_RESPONSE),
    } as unknown as ResponseWrapper;

    mockLlmApiCall.mockImplementation(async (prompt: string) => {
        if (prompt.includes(MOCK_DRAFTS[0].draft)) {
            return Promise.reject(error);
        }
        return Promise.resolve(llmSuccessResponse);
    });

    const { polishedCount, failures } = await Round4_Polish(RUN_ID, {
      llmApiCall: mockLlmApiCall,
      firestore: firestoreMock,
    });

    expect(polishedCount).toBe(1);
    expect(failures).toBe(1);
    expect(mockLlmApiCall).toHaveBeenCalledTimes(4);
    expect(firestoreMock.batch().set).toHaveBeenCalledTimes(2);
    expect(firestoreMock.batch().commit).toHaveBeenCalledTimes(1);
  });

  it("should handle zero drafts being found", async () => {
    firestoreMock.doc().get.mockResolvedValue({ exists: true, data: () => ({ items: [] }) });

    const { polishedCount, failures } = await Round4_Polish(RUN_ID, {
      llmApiCall: mockLlmApiCall,
      firestore: firestoreMock,
    });

    expect(polishedCount).toBe(0);
    expect(failures).toBe(0);
    expect(mockLlmApiCall).not.toHaveBeenCalled();
    expect(firestoreMock.batch().commit).not.toHaveBeenCalled();
  });

  it("should throw an error if the R3 artifact is not found", async () => {
    firestoreMock.doc().get.mockResolvedValue({ exists: false });

    await expect(
      Round4_Polish(RUN_ID, {
        llmApiCall: mockLlmApiCall,
        firestore: firestoreMock,
      })
    ).rejects.toThrow(`R3 artifact not found for runId=${RUN_ID}`);
  });

  it("should correcly use the buildPrompt function", async () => {
    const { polishedCount, failures } = await Round4_Polish(RUN_ID, {
      llmApiCall: mockLlmApiCall,
      firestore: firestoreMock,
    });

    expect( polishedCount).toBe(MOCK_DRAFTS.length);
    expect(failures).toBe(0);
    expect(mockLlmApiCall).toHaveBeenCalledTimes(MOCK_DRAFTS.length);
    expect(firestoreMock.batch().set).toHaveBeenCalledTimes(1);
    expect(firestoreMock.batch().commit).toHaveBeenCalledTimes(1);
  });
});
