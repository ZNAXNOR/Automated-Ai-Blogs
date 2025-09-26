import { _test, run } from '../../../rounds/r3_draft';
import { constants } from '../../../utils/constants';
import * as admin from 'firebase-admin';

const RUN_ID = 'test-run-456';

// Mocks
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
        doc: jest.fn(),
        collection: jest.fn(),
    })),
}));
jest.mock('../../../utils/logger');

describe('Round 3: Draft Generation', () => {
    let mockDoc: jest.Mock, mockCollection: jest.Mock, mockSet: jest.Mock, mockGet: jest.Mock;

    beforeEach(() => {
        mockSet = jest.fn();
        mockGet = jest.fn();
        mockDoc = jest.fn(() => ({ set: mockSet, get: mockGet }));
        mockCollection = jest.fn(() => ({ doc: mockDoc }));
        const firestore = admin.firestore as jest.Mock;
        firestore.mockReturnValue({ doc: mockDoc, collection: mockCollection });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should generate a draft for a valid outline', async () => {
        const r2Data = {
            items: [
                {
                    trend: 'Sustainable Living',
                    idea: '10 Easy Ways to Reduce Your Carbon Footprint at Home',
                    sections: [
                        { heading: 'Intro', bullets: ['Why it matters'], estWordCount: 50 },
                        { heading: 'Tips', bullets: ['Recycle', 'Compost', 'Use less water'], estWordCount: 300 },
                        { heading: 'Conclusion', bullets: ['Recap and call to action'], estWordCount: 50 },
                    ],
                },
            ],
        };
        mockGet.mockResolvedValue({ exists: true, data: () => r2Data });

        // Mock the LLM to return a valid draft
        const mockGenerator = jest.fn().mockResolvedValue('This is a sufficiently long and valid draft about reducing your carbon footprint.');
        await _test.run({ runId: RUN_ID }, mockGenerator);

        expect(mockDoc).toHaveBeenCalledWith(constants.ARTIFACT_PATHS.R2_OUTLINES.replace('{runId}', RUN_ID));
        expect(mockSet).toHaveBeenCalledTimes(1); // One draft should be written
    });

    it('should handle LLM failures gracefully', async () => {
        const r2Data = { items: [{ trend: 'Test', idea: 'Test', sections: [] }] };
        mockGet.mockResolvedValue({ exists: true, data: () => r2Data });

        // Mock the LLM to always fail
        const mockGenerator = jest.fn().mockRejectedValue(new Error('LLM Error'));
        const result = await _test.run({ runId: RUN_ID }, mockGenerator);

        expect(result.draftsCreated).toBe(0);
        expect(result.failures).toBe(1);
    });

    it('should retry if the draft is too short', async () => {
        const r2Data = { items: [{ trend: 'Test', idea: 'Test', sections: [] }] };
        mockGet.mockResolvedValue({ exists: true, data: () => r2Data });

        const shortDraft = 'Too short.';
        const longDraft = 'This is a much longer draft that should meet the minimum word count requirements for a blog post.'.repeat(10);
        const mockGenerator = jest.fn()
            .mockResolvedValueOnce(shortDraft) // First attempt
            .mockResolvedValueOnce(longDraft); // Second attempt

        await _test.run({ runId: RUN_ID }, mockGenerator);

        expect(mockGenerator).toHaveBeenCalledTimes(2);
        expect(mockSet).toHaveBeenCalledTimes(1);
    });
});
