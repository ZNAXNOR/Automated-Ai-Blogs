/**
 * tests/rounds/r5_meta.tests.ts
 *
 * Jest tests for Round 5 metadata generation.
 * Covers length rules, array validation, image suggestions, and stability checks.
 */

// 1. Define a mock implementation for the LLMClient's generate function
const llmMock = {
  generate: jest.fn(),
};

// 2. Mock the entire LLMClient module BEFORE importing the module under test
jest.mock("../../../utils/llmClient", () => {
  return {
    LLMClient: jest.fn(() => llmMock),
  };
});

// 3. Now that the mock is configured, import the function to be tested
const { runRound5 } = require("../../../rounds/r5_meta");

// 4. Define a valid, deterministic response that passes all validation rules
const validMockResponse = {
  seoTitle: "AI Marketing Trends: A Comprehensive Guide for 2024",
  metaDescription: "Explore the top AI-driven marketing strategies, tools, and use cases to stay ahead. Optimize your campaigns and drive growth with our expert insights.",
  tags: ["AI Marketing", "Digital Strategy", "Content Automation", "MarTech"],
  categories: ["Marketing", "Technology"],
  excerpt: "This is a detailed exploration into how artificial intelligence is fundamentally changing the marketing landscape. We cover everything from personalized content creation and automated campaign management to the ethical challenges that arise. Our guide provides practical, actionable advice for businesses looking to integrate AI into their workflows, ensuring they can leverage these powerful tools to connect with audiences more effectively and achieve a higher return on investment in a competitive digital world.", // 79 words
  relatedKeywords: ["AI in digital marketing", "Marketing automation", "AI content generation"],
  imageSuggestions: [
    "prompt: A futuristic marketing dashboard with glowing charts and AI icons.",
    "reuse: Company logo on a dark background."
  ],
};

describe("Round 5 - Metadata & Image Assets", () => {
  const sampleDraft = `
    Artificial intelligence tools are transforming the way marketers 
    engage with audiences. From automating content creation to optimizing 
    campaigns in real time, AI is reshaping digital marketing workflows. 
    This article explores the top trends, practical use cases, and 
    challenges businesses face when adopting AI-driven strategies.
  `;

  let result: any[];

  beforeAll(async () => {
    // 5. Configure the mock to return the valid response as a stringified JSON
    llmMock.generate.mockResolvedValue({ text: JSON.stringify(validMockResponse) });
    result = await runRound5([sampleDraft]);
  });

  beforeEach(() => {
    // Clear mock history before each test, but keep the resolved value
    llmMock.generate.mockClear();
  });

  it("generates at least one metadata block", () => {
    expect(result.length).toBeGreaterThan(0);
  });

  it("enforces SEO title length ≤ 70 chars", () => {
    result.forEach((meta) => {
      expect(meta.seoTitle).toBeDefined();
      expect(meta.seoTitle.length).toBeLessThanOrEqual(70);
      expect(meta.seoTitle.length).toBeGreaterThan(10);
    });
  });

  it("enforces meta description length ≤ 160 chars", () => {
    result.forEach((meta) => {
      expect(meta.metaDescription).toBeDefined();
      expect(meta.metaDescription.length).toBeLessThanOrEqual(160);
      expect(meta.metaDescription.length).toBeGreaterThan(30);
    });
  });

  it("validates excerpt length between 50–100 words", () => {
    result.forEach((meta) => {
      const wordCount = meta.excerpt.split(/\s+/).length;
      expect(wordCount).toBeGreaterThanOrEqual(50);
      expect(wordCount).toBeLessThanOrEqual(100);
    });
  });

  it("ensures tags, categories, relatedKeywords are arrays", () => {
    result.forEach((meta) => {
      expect(Array.isArray(meta.tags)).toBe(true);
      expect(meta.tags.length).toBeGreaterThanOrEqual(3);

      expect(Array.isArray(meta.categories)).toBe(true);
      expect(meta.categories.length).toBeGreaterThanOrEqual(1);

      expect(Array.isArray(meta.relatedKeywords)).toBe(true);
      expect(meta.relatedKeywords.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("ensures at least one image suggestion exists", () => {
    result.forEach((meta) => {
      expect(meta.imageSuggestions.length).toBeGreaterThan(0);
      // The validation is now in the core function, but we can check the result
      const hasContent = meta.imageSuggestions.some((s: string) => s.length > 0);
      expect(hasContent).toBe(true);
    });
  });

  it("ensures no empty fields", () => {
    result.forEach((meta) => {
      // Check main fields
      expect(meta.seoTitle).toBeTruthy();
      expect(meta.metaDescription).toBeTruthy();
      expect(meta.excerpt).toBeTruthy();
      // Check array fields have content
      expect(meta.tags.length).toBeGreaterThan(0);
      expect(meta.categories.length).toBeGreaterThan(0);
      expect(meta.relatedKeywords.length).toBeGreaterThan(0);
      expect(meta.imageSuggestions.length).toBeGreaterThan(0);
    });
  });

  it("ensures multiple drafts are handled", async () => {
    const drafts = [sampleDraft, "Another draft about AI in healthcare."];
    // Ensure the mock is configured for this specific test run
    llmMock.generate.mockResolvedValue({ text: JSON.stringify(validMockResponse) });
    const multiResult = await runRound5(drafts);
    expect(multiResult.length).toBe(drafts.length);
    // Check that the generate function was called for each draft
    expect(llmMock.generate).toHaveBeenCalledTimes(drafts.length);
  });

  it("checks content quality: title vs description vs excerpt", () => {
    result.forEach((meta) => {
      expect(meta.seoTitle).not.toEqual(meta.metaDescription);
      expect(meta.excerpt).not.toContain(meta.seoTitle);
      meta.tags.forEach((tag: string) => {
        expect(meta.categories).not.toContain(tag);
      });
    });
  });
});
