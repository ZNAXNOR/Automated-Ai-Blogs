const { Response: FetchResponse } = jest.requireActual("node-fetch");

// --- Test Data ---
const RUN_ID = "test-run-123";

const r0_doc_data = {
    items: [
        { query: "ai in marketing" },
        { query: "content automation" },
        { query: "ai marketing tools" },
    ],
};

const r1_ideation_data = [
    { trend: "ai in marketing", ideas: ["idea 1", "idea 2", "idea 3"] },
    { trend: "content automation", ideas: ["idea 4", "idea 5", "idea 6"] },
    { trend: "ai marketing tools", ideas: ["idea 7", "idea 8", "idea 9"] },
];

const r2_doc_data = {
    items: [
        {
            trend: "ai in marketing",
            idea: "idea 1",
            sections: [{ heading: "H1", bullets: ["B1"], estWordCount: 300 }],
        },
    ],
};

const r3_draft_data = {
    draft: `
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    This is a test draft that is sufficiently long to pass validation. It needs to be over 250 words to ensure that the test case is realistic and that the draft generation logic is working as expected. I will repeat this sentence a few times to make sure that the word count is high enough.
    `,
    trend: "ai in marketing",
    idea: "idea 1",
};

const r4_polished_data = {
    polished: "This is a detailed exploration into how artificial intelligence is fundamentally changing the marketing landscape. We cover everything from personalized content creation and automated campaign management to the ethical challenges that arise. Our guide provides practical, actionable advice for businesses looking to integrate AI into their workflows, ensuring they can leverage these powerful tools to connect with audiences more effectively and achieve a higher return on investment in a competitive digital world.",
    derivatives: ["A tweet.", "A LinkedIn post."],
};

const r5_meta_data = {
    seoTitle: "AI Marketing Trends: 2025 Guide",
    metaDescription: "Learn how AI is reshaping content creation and marketing workflows.",
    tags: ["AI", "Marketing", "Content Automation"],
    categories: ["Marketing", "Technology"],
    excerpt: "This is a detailed exploration into how artificial intelligence is fundamentally changing the marketing landscape. We cover everything from personalized content creation and automated campaign management to the ethical challenges that arise. Our guide provides practical, actionable advice for businesses looking to integrate AI into their workflows, ensuring they can leverage these powerful tools to connect with audiences more effectively and achieve a higher return on investment in a competitive digital world.",
    relatedKeywords: ["AI in marketing", "content automation", "AI marketing tools"],
    imageSuggestions: ["prompt: AI robot creating content", "reuse: company logo"],
};

const r7_wp_publish_response = {
    id: 12345,
    link: "https://example.com/wp-post-12345",
};

// --- Mock Environment & Dependencies ---

jest.mock("../../rounds/r0_trends", () => ({
    runR0_Trends: jest.fn().mockImplementation(async ({ runId }) => {
        const { getFirestore } = require("firebase-admin/firestore");
        const db = getFirestore();
        await db.doc(`runs/${runId}/artifacts/round0`).set(r0_doc_data);
    }),
}));

jest.mock("../../utils/config", () => ({
    env: {
        hfToken: "test-key",
        hfModelR1: "test-model-r1",
        hfModelR2: "test-model-r2",
        hfModelR3: "test-model-r3",
        hfModelR4: "test-model-r4",
        hfModelR5: "test-model-r5",
        hfModelR6: "test-model-r6",
        wpApiUrl: "https://example.com/wp-json/wp/v2",
        wpUsername: "test-user",
        wpPassword: "test-password",
        serpApiKey: "",
        useR0Llm: false,
        CACHE_TTL_HOURS: 24,
    },
}));

jest.mock("../../utils/llmClient", () => ({
    LLMClient: jest.fn(() => ({
        generate: jest.fn().mockResolvedValue({ text: JSON.stringify(r5_meta_data) }),
    })),
}));

jest.mock("node-fetch");

jest.mock("../../clients/http", () => ({
    httpClient: {
        request: jest.fn().mockImplementation((args: any) => {
            if (args.method === "GET" && args.url.includes("/tags")) {
                return Promise.resolve({ data: [{ id: 1 }], status: 200 });
            }
            if (args.method === "POST" && args.url.includes("/posts")) {
                return Promise.resolve({ data: r7_wp_publish_response, status: 201 });
            }
            return Promise.resolve({});
        }),
    },
}));

// --- In-Memory Firestore Mock ---
let fakeDb: { [key: string]: any } = {};

const docGetMock = jest.fn((path: string) => {
    const data = fakeDb[path];
    if (data) {
        return Promise.resolve({ exists: true, data: () => data, id: path.split('/').pop() });
    }
    return Promise.resolve({ exists: false, data: () => undefined });
});

const docSetMock = jest.fn((path: string, data: any) => {
    fakeDb[path] = data;
    return Promise.resolve();
});

const collectionAddMock = jest.fn((path: string, data: any) => {
    const docId = `test-doc-${Object.keys(fakeDb).length}`;
    const newPath = `${path}/${docId}`;
    fakeDb[newPath] = data;
    return Promise.resolve({ id: docId, path: newPath });
});

const collectionGetMock = jest.fn((path: string) => {
    const docs = Object.entries(fakeDb)
        .filter(([key]) => key.startsWith(path) && key.split('/').length === path.split('/').length + 1)
        .map(([key, value]) => ({ id: key.split('/').pop(), data: () => value, exists: true }));
    return Promise.resolve({ empty: docs.length === 0, docs, forEach: (callback: (doc: any) => void) => docs.forEach(callback) });
});

const queryGetMock = jest.fn(() => {
    const docs = r5_meta_data.tags.map((tag, index) => ({ id: `tag-${index}`, data: () => ({ name: tag, wp_id: index + 1 }), exists: true }));
    return Promise.resolve({ empty: docs.length === 0, docs, forEach: (callback: (doc: any) => void) => docs.forEach(callback) });
});

const batchSetMock = jest.fn((docRef: { path: string }, data: any) => docSetMock(docRef.path, data));

const collectionMock = (path: string) => ({
    path,
    doc: (docId?: string) => {
        const newDocId = docId || `test-doc-${Object.keys(fakeDb).length}`;
        return docMock(`${path}/${newDocId}`);
    },
    add: (data: any) => collectionAddMock(path, data),
    get: () => collectionGetMock(path),
    where: () => ({ limit: () => ({ get: () => queryGetMock() }) }),
});

const docMock = (path: string) => ({
    path,
    get: () => docGetMock(path),
    set: (data: any) => docSetMock(path, data),
    collection: (subPath: string) => collectionMock(`${path}/${subPath}`),
});

jest.mock("firebase-admin/firestore", () => ({
    getFirestore: () => ({
        collection: (path: string) => collectionMock(path),
        doc: (path: string) => docMock(path),
        batch: () => ({ set: batchSetMock, commit: jest.fn().mockResolvedValue(undefined) }),
    }),
    FieldValue: { serverTimestamp: () => "mock-server-timestamp" },
    Timestamp: { now: () => ({ toDate: () => new Date() }) },
}));

describe("Full Pipeline Integration", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        fakeDb = {};
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("runs all rounds and stores final WP draft", async () => {
        const mockFetch = require("node-fetch");

        (mockFetch as jest.Mock).mockImplementation((url: string, options?: any) => {
            if (url.includes("test-model-r1")) {
                return Promise.resolve(new FetchResponse(JSON.stringify([{ generated_text: JSON.stringify(r1_ideation_data) }]), { status: 200, headers: { "Content-Type": "application/json" } }));
            }
            if (url.includes("test-model-r2")) {
                return Promise.resolve(new FetchResponse(JSON.stringify([{ generated_text: JSON.stringify(r2_doc_data.items) }]), { status: 200, headers: { "Content-Type": "application/json" } }));
            }
            if (url.includes("test-model-r3")) {
                return Promise.resolve(new FetchResponse(JSON.stringify([{ generated_text: r3_draft_data.draft }]), { status: 200, headers: { "Content-Type": "application/json" } }));
            }
            if (url.includes("test-model-r4")) {
                return Promise.resolve(new FetchResponse(JSON.stringify([{ generated_text: JSON.stringify(r4_polished_data) }]), { status: 200, headers: { "Content-Type": "application/json" } }));
            }
            if (url.includes("test-model-r6")) {
                return Promise.resolve(new FetchResponse(JSON.stringify([0.9, 0.95]), { status: 200, headers: { "Content-Type": "application/json" } }));
            }
            return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
        });

        const { fullBlogPipeline } = require("../../full_blog_pipeline");
        await fullBlogPipeline(RUN_ID);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[PIPELINE_START]"));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Entering Round0_Trends"));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Entering Round7_Publish"));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[PIPELINE_END]"));

        const r1ArtifactPath = `runs/${RUN_ID}/artifacts/round1`;
        expect(fakeDb[r1ArtifactPath]).toBeDefined();
        expect(fakeDb[r1ArtifactPath].items.length).toBeGreaterThan(0);

        const r2ArtifactPath = `runs/${RUN_ID}/artifacts/round2`;
        expect(fakeDb[r2ArtifactPath]).toBeDefined();
        expect(fakeDb[r2ArtifactPath].items.length).toBeGreaterThan(0);

        const r3ArtifactPath = `runs/${RUN_ID}/artifacts/round3`;
        expect(fakeDb[r3ArtifactPath]).toBeDefined();

        const r4ArtifactPath = `runs/${RUN_ID}/artifacts/round4`;
        expect(fakeDb[r4ArtifactPath]).toBeDefined();
        const r4DistDocs = Object.keys(fakeDb).filter((k) => k.startsWith(`runs/${RUN_ID}/artifacts/round4_distribution/`));
        expect(r4DistDocs.length).toBeGreaterThan(0);

        const r5ArtifactPath = `runs/${RUN_ID}/artifacts/round5`;
        expect(fakeDb[r5ArtifactPath]).toBeDefined();
        const r5DistDocs = Object.keys(fakeDb).filter((k) => k.startsWith(`runs/${RUN_ID}/artifacts/round5_distribution/`));
        expect(r5DistDocs.length).toBeGreaterThan(0);

        const r6Docs = Object.keys(fakeDb).filter((k) => k.startsWith(`runs/${RUN_ID}/artifacts/round6/`));
        expect(r6Docs.length).toBeGreaterThan(0);

        const r7Docs = Object.keys(fakeDb).filter((k) => k.startsWith(`runs/${RUN_ID}/artifacts/round7/`));
        expect(r7Docs.length).toBeGreaterThan(0);
        const r7Artifact = fakeDb[r7Docs[0]];
        expect(r7Artifact.wpPostId).toEqual(r7_wp_publish_response.id);
    }, 30000);
});
