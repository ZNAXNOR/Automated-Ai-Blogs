import { _test, TrendItem } from "../../../rounds/r0_trends";

describe("Round0 deterministic processing", () => {
  test("normalizes, filters, dedupes, and limits to 12", () => {
    const buckets = [
      {
        type: "autocomplete" as const,
        sourceName: "serp:autocomplete",
        items: [
          "Apple iPhone 16 launch date?",
          "Latest",
          "my password reset", // should drop
          "2025 09 03 123 456", // >60% numeric -> drop
          "OpenAI o3 mini",
          "OpenAI o3  mini", // near-dup of previous
        ],
      },
      {
        type: "trending" as const,
        sourceName: "serp:trending",
        items: [
          "India vs Pakistan live",
          "OpenAI o3 mini features",
          "apple latest news", // allowed because contextual
        ],
      },
      {
        type: "rss" as const,
        sourceName: "rss:theverge",
        items: [
          "Apple announces iPhone 16 with camera upgrades",
          "OpenAI launches o3-mini updates",
          "News", // drop
        ],
      },
    ];

    const { items, sourceCounts } = _test.deterministicProcess(buckets);
    // schema checks
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeLessThanOrEqual(12);
    for (const it of items) {
      expect(typeof it.query).toBe("string");
      expect(["autocomplete", "related", "trending", "rss"]).toContain(it.type);
      expect(typeof it.score).toBe("number");
      expect(it.score).toBeGreaterThanOrEqual(0);
      expect(it.score).toBeLessThanOrEqual(1);
      expect(Array.isArray(it.source)).toBe(true);
    }

    // ensure dedupe happened for "OpenAI o3 mini"
    const openaiItems = items.filter((i: TrendItem) => i.query.includes("openai o3 mini"));
    expect(openaiItems.length).toBeLessThanOrEqual(1);

    // sourceCounts exists and counts some sources
    expect(sourceCounts).toBeTruthy();
    const sumCounts = Object.values(sourceCounts).reduce((a: number, b: number) => a + b, 0);
    expect(sumCounts).toBeGreaterThan(0);
  });

  test("drops empty and whitespace-only items", () => {
    const buckets = [
      {
        type: "autocomplete" as const,
        sourceName: "serp:autocomplete",
        items: ["", "   ", "\n\t"],
      },
    ];

    const { items } = _test.deterministicProcess(buckets);
    expect(items.length).toBe(0);
  });

  test("deduplicates case-insensitive variants", () => {
    const buckets = [
      {
        type: "trending" as const,
        sourceName: "serp:trending",
        items: ["OpenAI GPT-5", "openai gpt-5", "OPENAI GPT-5"],
      },
    ];

    const { items } = _test.deterministicProcess(buckets);
    expect(items.length).toBe(1);
    expect(items[0].query.toLowerCase()).toContain("openai gpt-5");
  });

  test("drops items with high numeric ratio", () => {
    const buckets = [
      {
        type: "autocomplete" as const,
        sourceName: "serp:autocomplete",
        items: ["1234567890 98765 4321"],
      },
    ];

    const { items } = _test.deterministicProcess(buckets);
    expect(items.length).toBe(0);
  });

  test("respects 12 item limit with overflow", () => {
    const buckets = [
      {
        type: "rss" as const,
        sourceName: "rss:test",
        items: Array.from({ length: 30 }, (_, i) => `Topic ${i + 1}`),
      },
    ];

    const { items } = _test.deterministicProcess(buckets);
    expect(items.length).toBeLessThanOrEqual(12);
  });

  test("tracks multiple source counts correctly", () => {
    const buckets = [
      {
        type: "rss" as const,
        sourceName: "rss:test",
        items: ["Alpha", "Beta"],
      },
      {
        type: "trending" as const,
        sourceName: "serp:trending",
        items: ["Gamma"],
      },
    ];

    const { sourceCounts } = _test.deterministicProcess(buckets);
    expect(sourceCounts["rss:test"]).toBeGreaterThanOrEqual(1);
    expect(sourceCounts["serp:trending"]).toBeGreaterThanOrEqual(1);
  });

  test("handles completely empty buckets gracefully", () => {
    const buckets: any[] = [];
    const { items, sourceCounts } = _test.deterministicProcess(buckets);
    expect(items).toEqual([]);
    expect(sourceCounts).toEqual({});
  });
});