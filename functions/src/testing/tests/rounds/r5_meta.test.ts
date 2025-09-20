jest.mock("../../../utils/llmClient");

import { _test as r5_test_functions, Round5_Meta } from "../../../rounds/r5_meta";
const { generateMetaForDraft } = r5_test_functions;

import { LLMClient } from "../../../utils/llmClient";

const llmMock = new LLMClient() as jest.Mocked<LLMClient>;

// Sample data for testing
const sampleDraft = `
  Exploring the Alps: A solo journey through breathtaking landscapes. This was a challenging yet rewarding experience that pushed my physical and mental limits. I hiked for days, surrounded by majestic peaks and serene valleys, and the solitude allowed for deep introspection and a profound connection with nature. The journey was not just about the destination, but about the process of getting there—the early morning starts, the steep ascents, and the rewarding views from the summit. It taught me the importance of perseverance, resilience, and the beauty of simplicity. I returned with a renewed sense of purpose and a deep appreciation for the power of the natural world. This is a story of adventure, self-discovery, and the transformative power of a solo journey into the wild.
`;

const validMockResponse = {
    seoTitle: "AI Marketing Trends: A Comprehensive Guide for 2024",
    metaDescription: "Explore the top AI-driven marketing strategies, tools, and use cases to stay ahead. Optimize your campaigns and drive growth with our expert insights.",
    tags: ["AI Marketing", "Digital Strategy", "Content Automation", "MarTech"],
    categories: ["Marketing", "Technology"],
    excerpt: "This is a detailed exploration into how artificial intelligence is fundamentally changing the marketing landscape. We cover everything from personalized content creation and automated campaign management to the ethical challenges that arise. Our guide provides practical, actionable advice for businesses looking to integrate AI into their workflows, ensuring they can leverage these powerful tools to connect with audiences more effectively and achieve a higher return on investment in a competitive digital world.",
    relatedKeywords: ["AI in digital marketing", "Marketing automation", "AI content generation"],
    imageSuggestions: ["prompt: A futuristic marketing dashboard with glowing charts and AI icons.", "reuse: Company logo on a dark background."],
};


describe("Round 5 - Metadata & Image Assets", () => {
  beforeEach(() => {
    // Reset mocks before each test
    llmMock.generate.mockClear();
    // Corrected Mock: This test expects an object with a `text` property.
    llmMock.generate.mockResolvedValue({ text: JSON.stringify(validMockResponse) });
  });

  it("generates valid metadata for a single draft and matches snapshot", async () => {
    const result = await generateMetaForDraft(sampleDraft, llmMock);
    expect(result).toBeDefined();
    // Snapshot test to detect unexpected schema changes
    expect(result).toMatchSnapshot();
  });

  it("enforces SEO title length ≤ 70 chars", async () => {
    const result = await generateMetaForDraft(sampleDraft, llmMock);
    const meta = result!;
    expect(meta.seoTitle).toBeDefined();
    expect(meta.seoTitle.length).toBeLessThanOrEqual(70);
  });

  it("enforces meta description length ≤ 160 chars", async () => {
    const result = await generateMetaForDraft(sampleDraft, llmMock);
    const meta = result!;
    expect(meta.metaDescription).toBeDefined();
    expect(meta.metaDescription.length).toBeLessThanOrEqual(160);
  });

  it("validates excerpt word count robustly (between 50–100 words)", async () => {
    const result = await generateMetaForDraft(sampleDraft, llmMock);
    const meta = result!;
    const wordCount = meta.excerpt.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeGreaterThanOrEqual(50);
    expect(wordCount).toBeLessThanOrEqual(100);
  });

  it("ensures tags, categories, relatedKeywords are non-empty arrays", async () => {
    const result = await generateMetaForDraft(sampleDraft, llmMock);
    const meta = result!;
    expect(Array.isArray(meta.tags)).toBe(true);
    expect(meta.tags.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(meta.categories)).toBe(true);
    expect(meta.categories.length).toBeGreaterThan(0);
    expect(Array.isArray(meta.relatedKeywords)).toBe(true);
    expect(meta.relatedKeywords.length).toBeGreaterThanOrEqual(3);
  });

  it("validates image suggestions for content and format hints", async () => {
    const result = await generateMetaForDraft(sampleDraft, llmMock);
    const meta = result!;
    expect(meta.imageSuggestions.length).toBeGreaterThan(0);
    const hasValidHint = meta.imageSuggestions.some((s: string) => s.startsWith("prompt:") || s.startsWith("reuse:"));
    expect(hasValidHint).toBe(true);
  });

  it("ensures no empty fields", async () => {
    const result = await generateMetaForDraft(sampleDraft, llmMock);
    const meta = result!;
    // Check main fields
    expect(meta.seoTitle).toBeTruthy();
    expect(meta.metaDescription).toBeTruthy();
    expect(meta.excerpt).toBeTruthy();
    // Check arrays
    expect(meta.tags.length).toBeGreaterThan(0);
    expect(meta.categories.length).toBeGreaterThan(0);
    expect(meta.relatedKeywords.length).toBeGreaterThan(0);
    expect(meta.imageSuggestions.length).toBeGreaterThan(0);
  });

  it("handles multiple drafts with varied LLM responses", async () => {
    const drafts = [sampleDraft, sampleDraft, sampleDraft];
    const invalidJsonResponse = { text: "This is not JSON." };

    llmMock.generate
      .mockResolvedValueOnce({ text: JSON.stringify(validMockResponse) })
      .mockRejectedValueOnce(new Error("Invalid JSON"))
      .mockResolvedValueOnce({ text: JSON.stringify(validMockResponse) }); // reuse for the third call

    const multiResult = await Promise.all(drafts.map(draft => generateMetaForDraft(draft, llmMock)));
    
    expect(multiResult.length).toBe(drafts.length);
    expect(llmMock.generate).toHaveBeenCalledTimes(drafts.length);
    
    // Check that we got a successful result for the first and third calls
    expect(multiResult[0]).not.toBeNull();
    expect(multiResult[2]).not.toBeNull();
    
    // Check that the second call, which had an invalid response, returned null
    expect(multiResult[1]).toBeNull();
  });

  it("handles empty and very short drafts gracefully", async () => {
    const edgeCaseDrafts = ["", "Too short."];
    const result = await Promise.all(edgeCaseDrafts.map(draft => generateMetaForDraft(draft, llmMock)));
    expect(result.length).toBe(edgeCaseDrafts.length);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(llmMock.generate).not.toHaveBeenCalled();
  });

  it("checks content quality: title vs description vs excerpt", async () => {
    const result = await generateMetaForDraft(sampleDraft, llmMock);
    const meta = result!;
    expect(meta.seoTitle).not.toEqual(meta.metaDescription);
    // Description should be substantially longer than the title
    expect(meta.metaDescription.length).toBeGreaterThan(meta.seoTitle.length);
  });
});
