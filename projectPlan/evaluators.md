## 🧩 `core_evaluators.md`

### **File:** `/docs/core_evaluators.md`

### **Purpose:**

A global evaluator registry that defines, describes, and standardizes evaluation logic across all Genkit flows.
These evaluators may be invoked individually or collectively to measure internal metrics like SEO, readability, or authenticity.

---

## 🧱 **Overview**

| Evaluator Name                    | Purpose                                     | Type                                            | Status     |
| --------------------------------- | ------------------------------------------- | ----------------------------------------------- | ---------- |
| `readabilityEvaluator`            | Evaluate ease of reading and clarity        | External API (APYHub)                           | ✅ Core     |
| `humanizationEvaluator`           | Assess human-likeness and natural tone      | Rule-based + Optional LLM                       | ✅ Core     |
| `seoEvaluator`                    | Analyze on-page SEO quality                 | Logic-based                                     | ✅ Core     |
| `metadataEvaluator`               | Validate blog metadata consistency          | Logic-based                                     | ✅ Core     |
| *(Future)* `plagiarismEvaluator`  | Detect duplicate or copied content          | External (Copyleaks, PlagiarismCheck.org, etc.) | 🔜 Planned |
| *(Future)* `engagementEvaluator`  | Predict engagement or click potential       | LLM-based heuristic                             | 🔜 Planned |
| *(Future)* `brandToneEvaluator`   | Ensure tone consistency with brand identity | LLM/embedding-based                             | 🔜 Planned |
| *(Future)* `performanceEvaluator` | Analyze post-publish traffic & metrics      | Analytics API                                   | 🔜 Planned |

---

## ⚙️ **Evaluator Specifications**

---

### 🧠 1. `readabilityEvaluator`

**Purpose:**
Evaluate how easy the content is to read and understand for general audiences.

**API:**
🔗 [APYHub Readability Scores API](https://apyhub.com/utility/readability-scores)

**Input Schema:**

```ts
{
  text: string;
}
```

**Output Schema:**

```ts
{
  readabilityScore: number; // 0–100
  gradeLevel: string;
  details: {
    flesch_kincaid?: number;
    gunning_fog?: number;
    smog_index?: number;
  };
}
```

**Usage Example:**

```ts
const result = await evaluate("readabilityEvaluator", { text: blogContent });
```

**Implementation Notes:**

* Normalize all available metrics into a 0–100 scale.
* Store both raw values and averaged `readabilityScore`.
* Recommended range: 60–80.

---

### 🤖 2. `humanizationEvaluator`

**Purpose:**
Assess whether the text appears *naturally written by a human* rather than AI-generated.

**Type:**
Hybrid (rule-based + LLM reasoning fallback)

**Input Schema:**

```ts
{
  text: string;
}
```

**Output Schema:**

```ts
{
  humanizationScore: number; // 0–100
  detectedPatterns: string[]; // e.g. "repetitive structure", "formal tone"
  recommendations: string[];
}
```

**Logic Heuristics:**

* Sentence length variance
* Presence of contractions and colloquialisms
* Overuse of connectors (Moreover, Furthermore, etc.)
* Stylistic variety
* Emotion / opinion cues

**Optional Enhancement:**
Use a lightweight Genkit LLM check:

```ts
const response = await ai.generate({
  system: "You are a senior editor detecting AI-generated writing patterns.",
  prompt: `Rate the following text's human-likeness (0–100) and justify:\n\n${text}`
});
```

---

### 🔍 3. `seoEvaluator`

**Purpose:**
Check SEO quality of the text content before publishing.

**Method:**
Rule-based scoring with optional external API for ranking verification.

**Primary (Offline) Checks:**

* Title length: 55–60 chars
* Meta description length: 150–160 chars
* Slug hygiene: lowercase, hyphenated, keyword present
* Keyword presence in title, meta, and body
* Keyword density (1–2%)
* Presence of internal/external links

**Input Schema:**

```ts
{
  title: string;
  metaDescription: string;
  slug: string;
  keywords: string[];
  content: string;
}
```

**Output Schema:**

```ts
{
  seoScore: number; // 0–100
  issues: string[];
  recommendations: string[];
}
```

**Optional Future Integration:**

* 🔗 [APYHub SERP Rank Checker API](https://apyhub.com/utility/serp-rank-checker)
  → to fetch live keyword ranks post-publishing.

---

### 🧾 4. `metadataEvaluator`

**Purpose:**
Ensure completeness, validity, and logical correctness of blog metadata fields.

**Method:**
Schema and enum validation.

**Input Schema:**

```ts
{
  title: string;
  category: string;
  tags: string[];
  slug: string;
}
```

**Output Schema:**

```ts
{
  metadataScore: number;
  valid: boolean;
  issues: string[];
}
```

**Logic Rules:**

* Title non-empty, < 80 chars
* Category ∈ `BLOG_TOPICS`
* Tags ⊂ predefined tag list
* Slug kebab-case, matches title
* No duplicates

---

## 🧭 **Evaluator Integration Pattern**

These evaluators can be:

1. Invoked **individually** inside any flow (e.g., R4 polish validation).
2. Combined via a **global evaluation runner** in Genkit (e.g., `/flows/core_evaluation.ts`).

**Example Integration (R5):**

```ts
const readability = await evaluate('readabilityEvaluator', { text });
const seo = await evaluate('seoEvaluator', { title, metaDescription, content });
const humanization = await evaluate('humanizationEvaluator', { text });

const evaluationSummary = {
  readabilityScore: readability.readabilityScore,
  seoScore: seo.seoScore,
  humanizationScore: humanization.humanizationScore,
  metadataScore: metadata.metadataScore,
};
```

---

## 🧠 **Future Global Evaluators (to be added later)**

| Evaluator              | Description                                                                              | Implementation Plan     |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| `plagiarismEvaluator`  | Detect content duplication using public APIs (e.g., PlagiarismCheck.org, ContentChecker) | External API            |
| `brandToneEvaluator`   | Measure tone consistency vs stored brand tone embeddings                                 | LLM + Vector Embeddings |
| `engagementEvaluator`  | Predict CTR, shares, engagement likelihood                                               | LLM heuristic           |
| `performanceEvaluator` | Post-publish analytics integration (e.g., GA4, Search Console)                           | External data sources   |

---

## ✅ **Summary**

This `core_evaluators.md` document establishes:

* 4 fully defined core evaluators (readability, humanization, SEO, metadata)
* 4 planned evaluators for future integration
* Global integration pattern for Genkit
* Common schemas for reuse in all flows
