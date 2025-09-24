import { Round6_Coherence as runRound6 } from "../../../rounds/r6_coherence";
import { R5Meta } from "../../../utils/types";
import { getFirestore } from 'firebase-admin/firestore';
import { calculateSimilarity } from '../../../clients/hf_sentence';

// --- Mocks Setup ---

jest.mock('firebase-admin/firestore', () => {
    const mocks = {
        doc: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        batch: jest.fn(),
        batchSet: jest.fn(),
        batchCommit: jest.fn(),
    };
    mocks.doc.mockReturnValue({ get: mocks.get, set: mocks.set });
    mocks.batch.mockReturnValue({ set: mocks.batchSet, commit: mocks.batchCommit });
    const mockedGetFirestore = jest.fn().mockReturnValue({ doc: mocks.doc, batch: mocks.batch });
    (mockedGetFirestore as any).__firestoreMocks = mocks;
    return { getFirestore: mockedGetFirestore, FieldValue: { serverTimestamp: jest.fn() } };
});

jest.mock('../../../clients/hf_sentence');
const mockedCalculateSimilarity = calculateSimilarity as jest.Mock;

// --- Helper to access the mocks ---
const getMocks = () => (getFirestore as any).__firestoreMocks;

// --- Test Data ---
const r5Items: R5Meta[] = [
  { trendId: "t1", title: "The Renaissance of Board Games", draft: "...", metaTitle: "...", metaDescription: "..." },
  { trendId: "t2", title: "The Science of Sleep", draft: "...", metaTitle: "...", metaDescription: "..." },
];

// --- Test Suite ---
describe("Pairwise: R5 -> R6", () => {
  const runId = "pairwise-test-r5-r6";

  beforeEach(() => {
    const mocks = getMocks();
    Object.values(mocks).forEach((mock: any) => mock.mockClear());
    mockedCalculateSimilarity.mockClear();

    mocks.get.mockResolvedValue({ exists: true, data: () => ({ items: r5Items }) });
    mocks.batchCommit.mockResolvedValue(null);
    mockedCalculateSimilarity.mockResolvedValue(new Array(r5Items.length).fill(0.85));
    
    process.env.HUGGINGFACE_API_KEY_SENTENCE = "test-key";
    process.env.HUGGINGFACE_SENTENCE_MODEL = "test-model";
  });

  test("R5 output feeds correctly into R6 coherence generation", async () => {
    // --- Arrange ---
    const mocks = getMocks();
    
    const mockReq: any = {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: { data: { runId } },
        get: (header: string) => mockReq.headers[header.toLowerCase()],
        header: (header: string) => mockReq.headers[header.toLowerCase()],
    };

    const mockRes: any = {
        statusCode: 200,
        status: (code: number) => {
            mockRes.statusCode = code;
            return mockRes;
        },
        setHeader: jest.fn(),
        getHeader: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
    };

    // --- Act ---
    await runRound6(mockReq, mockRes);

    // --- Assert ---
    expect(mockRes.send).toHaveBeenCalledWith({ result: { coherenceCount: 2, failures: 0 } });
    expect(mocks.doc).toHaveBeenCalledWith(`runs/${runId}/artifacts/round5_meta`);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.batch).toHaveBeenCalled();
    expect(mocks.doc).toHaveBeenCalledWith(`runs/${runId}/artifacts/round6_coherence`);
    expect(mocks.batchSet).toHaveBeenCalledTimes(1);
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);

    const writtenData = mocks.batchSet.mock.calls[0][1];
    expect(writtenData).toHaveProperty("items");
    expect(writtenData.items.length).toBe(r5Items.length);

    for (const item of writtenData.items) {
      expect(item).toHaveProperty("coherenceScores");
      expect(item.coherenceScores.overall).toBe(0.85);
    }
  }, 10000);
});
