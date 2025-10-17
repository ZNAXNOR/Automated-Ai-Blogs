# Round 2 — Topic Angling

## Purpose / Role  
Refine a selected blog topic (from Round 1) into a clear, differentiated **angle of attack**.  
This round evaluates real-world sources, identifies what’s already covered, and helps shape a unique, data-aware perspective before drafting begins.

## Interface  

| Input              | Type              | Description                                                                                              |
| ------------------ | ----------------- | -------------------------------------------------------------------------------------------------------- |
| `r1_ideate_output` | object            | Single topic idea selected from Round 1 (includes `title`, `rationale`, `seed`, and `sources[]`)         |
| → returns          | `r2_angle_output` | Enriched topic object containing refined title, angle statement, key insights, and summarized references |

Persist to `artifacts.round2`.

---

### **Flow Structure**

```mermaid
          ┌──────────────────────────────────────────────────────────────┐
          │                 Input: r2_angle_input                        │
          └────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
          ┌──────────────────────────────────────────────────────────────┐
          │     Tool: Source Relevance & Summarization                   │
          │  • Retrieve high-quality sources related to topic            │
          │  • Generate concise relevant summaries                       │
          └────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
          ┌──────────────────────────────────────────────────────────────┐
          │     # AI Prompt: r2_angle_prompt                             │
          │  • Use relevantSummaries[] to generate topic “angles”        │
          │  • Form structured responses for the next enrichment phase   │
          └────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
          ┌──────────────────────────────────────────────────────────────┐
          │    # Schema Validation + Enrichment                          │
          │  • Validate structure and fields against r2 schema           │
          │  • Add contextual enrichment and missing metadata            │
          └────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
          ┌──────────────────────────────────────────────────────────────┐
          │    # Persist: artifacts.round2 (Firestore)                   │
          │  • Store enriched data and references                        │
          │  • Maintain audit trail of transformations                   │
          └────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
          ┌──────────────────────────────────────────────────────────────┐
          │    # Output: r2_angle_output                                 │
          │  • Final validated and enriched angle data ready for R3      │
          └──────────────────────────────────────────────────────────────┘

````

---

## MVP Behavior

* Use the **link reader tool** to evaluate and summarize referenced URLs from Round 1.
* For each link:

  * Determine whether it is **relevant** to the chosen topic.
  * If yes, produce a **1–2 sentence summary** and assign a simple `relevanceScore` (0–1).
* Pass all relevant summaries, along with the original topic data, into the AI prompt (`r2_angle_prompt`).
* The LLM (Gemini 2.0 Flash, free tier) synthesizes:

  * A **refined title** and short **subtitle**.
  * A **core angle statement** expressing how this blog can stand out.
  * 3–5 **key insights** or thematic points to guide later writing.
  * (Optionally) a few **support examples** pulled or inferred from references.

---

## Example Input

```json
{
  "title": "Humanize AI: The Future of Authentic Social Media Marketing",
  "rationale": "With the rise of AI tools for social media marketing, there's a growing need to maintain a human touch...",
  "seed": "humanize AI",
  "sources": [
    "https://blog.hootsuite.com/humanize-ai-content/",
    "https://sproutsocial.com/insights/ai-social-media-trends/"
  ]
}
```

---

## Example Output

```json
{
  "refinedTitle": "Keeping the Human Touch in AI-Powered Marketing",
  "subtitle": "Balancing automation with authenticity across social platforms",
  "angleStatement": "Most AI content advice focuses on tools — this piece focuses on tone: how marketers can humanize AI workflows without losing efficiency.",
  "keyInsights": [
    "People trust emotion and storytelling, not templates.",
    "AI can enhance empathy when trained on authentic brand voice data.",
    "Human review loops improve content relatability."
  ],
  "supportExamples": [
    "Case study: Starbucks’ AI-driven yet human-approved campaign copy.",
    "Example: LinkedIn posts using ChatGPT prompts refined by tone guides."
  ],
  "sourceAnalysis": [
    {
      "url": "https://blog.hootsuite.com/humanize-ai-content/",
      "shortDescription": "Explains how brands can keep content genuine while using AI.",
      "relevanceScore": 0.92
    },
    {
      "url": "https://sproutsocial.com/insights/ai-social-media-trends/",
      "shortDescription": "Covers social media automation trends; tangentially relevant.",
      "relevanceScore": 0.61
    }
  ],
  "seed": "humanize AI",
  "timestamp": "2025-10-13T15:21:00Z"
}
```

---

## Refined / Advanced Goals

* Weight sources by **domain authority** or topical similarity.
* Use embeddings to measure **angle overlap** with existing SERP content.
* Automatically insert validated citations for `[source?]` placeholders.
* Detect **gaps** (themes competitors haven’t addressed).
* Offer multiple **angle variants** (e.g., opinion, tutorial, listicle).

---

## Common Failure Modes & Diagnostics

| Symptom                               | Cause                | Action                                                   |
| ------------------------------------- | -------------------- | -------------------------------------------------------- |
| No relevant summaries returned        | Weak or broken links | Validate URLs before tool call                           |
| AI produces generic or repeated angle | Summaries too thin   | Provide richer summaries or add examples in prompt       |
| Overlapping key insights              | Poor dedupe          | Use embedding similarity threshold                       |
| Missing or low-scoring relevance data | Schema mismatch      | Ensure reader tool output conforms to expected structure |

---

## Pro Practices / Enhancements

* Use temperature ≈ 0.3 for analytical stability.
* Provide 1–2 **few-shot examples** of good “angle statements” in the prompt.
* Log `relevanceScore` distributions for debugging low-yield rounds.
* Maintain a cache of evaluated URLs to skip redundant reads.
* Optionally re-rank outputs by novelty (embedding distance vs. summaries).

---

## When It Goes Wrong — Questions to Ask

1. Are URLs being properly fetched and parsed by the reader tool?
2. Do the summaries contain useful topic-specific data or just fluff?
3. Did the AI actually synthesize an *angle* (a unique stance), not just an outline?
4. Is Firestore persistence schema-compliant?
5. Are duplicate or near-identical angles being generated across runs?