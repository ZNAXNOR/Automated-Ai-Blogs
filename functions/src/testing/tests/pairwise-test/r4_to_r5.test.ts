jest.mock("../../../utils/llmClient");

import { _test as r5_test_functions } from "../../../rounds/r5_meta";
const { generateMetaForDraft } = r5_test_functions;

import { LLMClient } from "../../../utils/llmClient";

const llmMock = new LLMClient() as jest.Mocked<LLMClient>;

const r4Sample = {
  id: "test-draft-1",
  polished: `
    The future of AI in marketing is not just about automation; it's about creating hyper-personalized experiences that resonate with customers on a deeper level. This draft explores how AI can analyze vast amounts of customer data to predict behavior, tailor content, and optimize campaigns in real-time. We delve into the ethical considerations and the importance of transparency in AI-driven marketing, ensuring that customer trust is maintained. The article also provides actionable insights for marketers looking to adopt AI tools, highlighting the potential for unprecedented efficiency and engagement. By leveraging AI, brands can build deeper, more meaningful relationships with their audience, turning data into a competitive advantage. This is not a distant future; it's happening now, and early adopters are already reaping the rewards. We examine case studies from leading brands that have successfully integrated AI into their marketing strategies. From chatbots that provide instant support to predictive analytics that forecast trends, the applications are vast. The key is to balance technological power with a human-centric approach, ensuring that AI serves rather than dictates. This comprehensive guide will equip you with the knowledge to navigate the evolving landscape of AI in marketing.
  `,
  derivatives: [
    "AI is revolutionizing marketing by enabling hyper-personalized content. #AI #Marketing",
    "Leverage AI to predict customer behavior and optimize your marketing campaigns in real-time.",
  ],
};

const validMockResponse = {
    seoTitle: "AI Marketing Trends: 2025 Guide",
    metaDescription: "Learn how AI is reshaping content creation and marketing workflows.",
    tags: ["AI", "Marketing", "Content Automation"],
    categories: ["Marketing", "Technology"],
    excerpt: "This is a detailed exploration into how artificial intelligence is fundamentally changing the marketing landscape. We cover everything from personalized content creation and automated campaign management to the ethical challenges that arise. Our guide provides practical, actionable advice for businesses looking to integrate AI into their workflows, ensuring they can leverage these powerful tools to connect with audiences more effectively and achieve a higher return on investment in a competitive digital world.",
    relatedKeywords: ["AI in marketing", "content automation", "AI marketing tools"],
    imageSuggestions: ["prompt: AI robot creating content", "reuse: company logo"]
};


describe("R4 → R5 Pairwise Metadata Generation", () => {
  beforeEach(() => {
    llmMock.generate.mockClear();
    llmMock.generate.mockResolvedValue({ text: JSON.stringify(validMockResponse) });
  });

  it("generates metadata for a single polished draft and matches snapshot", async () => {
    const result = await Promise.all([r4Sample.polished].map(draft => generateMetaForDraft(draft, llmMock)));
    expect(result.length).toBe(1);
    const meta = result[0]!;
    expect(meta.seoTitle).toBeDefined();
    expect(meta.tags.length).toBeGreaterThan(0);
    expect(meta).toMatchSnapshot();
  });

  it("generates metadata for multiple R4 items", async () => {
    const items = [
      r4Sample.polished,
      r4Sample.polished, // Using the same long draft twice
      r4Sample.polished
    ];
    const result = await Promise.all(items.map(draft => generateMetaForDraft(draft, llmMock)));
    expect(result.length).toBe(items.length);
    // Ensure LLM was called once per item
    expect(llmMock.generate).toHaveBeenCalledTimes(items.length);
  });

  it("ensures metadata fields are non-empty and arrays are valid", async () => {
    const result = await Promise.all([r4Sample.polished].map(draft => generateMetaForDraft(draft, llmMock)));
    const meta = result[0]!;
    expect(meta.seoTitle).toBeTruthy();
    expect(meta.metaDescription).toBeTruthy();
    expect(meta.excerpt).toBeTruthy();
    expect(meta.tags.length).toBeGreaterThan(0);
    expect(meta.categories.length).toBeGreaterThan(0);
    expect(meta.relatedKeywords.length).toBeGreaterThan(0);
    expect(meta.imageSuggestions.length).toBeGreaterThan(0);
  });

  it("validates content length limits", async () => {
    const result = await Promise.all([r4Sample.polished].map(draft => generateMetaForDraft(draft, llmMock)));
    const meta = result[0]!;
    expect(meta.seoTitle.length).toBeLessThanOrEqual(70);
    expect(meta.metaDescription.length).toBeLessThanOrEqual(160);
    const wordCount = meta.excerpt.split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeGreaterThanOrEqual(50);
    expect(wordCount).toBeLessThanOrEqual(100);
  });
});
