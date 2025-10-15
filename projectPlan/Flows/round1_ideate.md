# **Round 1 – Ideate Flow**

### *File: `r1_ideate.flow.ts`*

---

## **Purpose**

The `r1_ideate` flow evaluates the candidate topics generated in **Round 0** and selects **one winning seed idea** to move forward.
It performs light reasoning and validation — ensuring the chosen idea aligns with trend relevance, originality, and search value.

This marks the transition from “topic exploration” to “focused concept selection.”

---

## **Interface**

| Input        | Type                                     | Description                                |
| ------------ | ---------------------------------------- | ------------------------------------------ |
| `topic`      | string (optional)                        | One blog topic or theme to evaluate        |
| `seedPrompt` | string (optional)                        | Full trend data or seed context from `r0`  |
| → returns    | `{ title, rationale, seed, sourceUrl? }` | The single selected topic to proceed to r2 |

Output is persisted to **`artifacts.round1`** and **Firestore**, and directly feeds into `r2_outline`.

---

## **Model & Prompt Configuration**

| Property          | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| **Model**         | `googleai/gemini-2.0-flash` *(Free, ideal balance of speed & accuracy)* |
| **Type**          | Prompt-based subflow (`ai.definePrompt`)                                |
| **Temperature**   | `0.35` *(for stable reasoning)*                                         |
| **Persistence**   | Firestore JSON document                                                 |
| **Output Schema** | `r1_ideate_output` (validated with Zod)                                 |

The model analyzes all candidate topics from `r0`, ranks them internally by relevance, and returns **only the top-scoring seed** with reasoning and reference placeholders.

---

## **Flow Behavior**

1. Receives full input from **r0** (trend arrays and candidate topics).
2. Selects one blog topic array (based on strength, novelty, or data density).
3. Calls `r1_ideate_prompt` with the chosen array to evaluate and rank ideas.
4. Extracts and returns **only one final idea** (`title`, `rationale`, `seed`).
5. Persists output to Firestore and passes the seed into `r2_outline`.

---

## **Flow Structure**

```mermaid
          ┌────────────────────────────────────┐
          │       Input: r1_ideate_input       │
          └───────────────────┬────────────────┘
                              │
                              ▼
          ┌────────────────────────────────────┐
          │   Evaluate all blog topic arrays   │
          └───────────────────┬────────────────┘
                              │
                              ▼
          ┌────────────────────────────────────┐
          │  Apply selection logic: novelty,   │
          │  trend strength, depth, sources    │
          └───────────────────┬────────────────┘
                              │
                              ▼
          ┌────────────────────────────────────┐
          │    Choose one blog topic array     │
          └───────────────────┬────────────────┘
                              │
                              ▼
          ┌────────────────────────────────────┐
          │    Evaluate and rank candidate     │
          │   topics using Gemini 2.0 Flash    │
          └───────────────────┬────────────────┘
                              │
                              ▼
          ┌────────────────────────────────────┐
          │      Choose top-scoring idea →     │
          │     title, rationale, seed, url?   │
          └───────────────────┬────────────────┘
                              │
                              ▼
          ┌────────────────────────────────────┐
          │    Save decision + metadata to     │
          │  Firestore (with URLs, reasoning)  │
          └───────────────────┬────────────────┘
                              │
                              ▼
          ┌────────────────────────────────────┐
          │     Output: r1_ideate_output       │
          └────────────────────────────────────┘
```

---

## **Sample Prompt (as Implemented)**

```js
SYSTEM: You are a concise content strategist. 
You evaluate trend-based topic ideas and pick one that is timely, valuable, and clear.

TASK:
Given TREND_SIGNALS, select the single best blog topic.
Return one title, its rationale, and seed keyword.

CONSTRAINTS:
- The title must contain a keyword from input.
- The rationale must explain why this idea is strongest now.
- End rationale with [source?].
- Return only valid JSON matching schema.
- No Markdown, no comments, no code fences.

INPUT/TREND_SIGNALS: {{trendInput}}
```

---

## **Refined Behavior (Next Iteration Goals)**

| Goal                       | Description                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Array Evaluation Logic** | Build scoring logic to select one blog topic array from r0 (e.g. based on novelty, trend strength, or news recency). |
| **Reference Retention**    | Save the selected topic’s source URLs (from r0 or News API) for future citation or contextual use in r2–r3.          |
| **Automatic Ranking**      | Add optional scoring (0–1 scale) for transparency in selection.                                                      |
| **Chaining Parity**        | Pass output directly into `r2_outline` as the seed input.                                                            |

---

## **Example Firestore Schema**

**Collection:** `r1_ideate_results`

```json
{
  "title": "AI SEO Tools Are Changing How Content Is Ranked",
  "rationale": "This topic merges two active trend clusters (AI tools and SEO automation) with low saturation and rising interest [source?]",
  "seed": "AI SEO tools",
  "sourceUrl": "https://news.google.com/articles/ai-seo-2025",
  "timestamp": "2025-10-09T21:05:00Z"
}
```

---

## **Common Failure Modes & Fixes**

| Symptom                        | Cause                         | Action                                    |
| ------------------------------ | ----------------------------- | ----------------------------------------- |
| Output includes multiple ideas | Prompt not restrictive enough | Add rule: “Return only one idea.”         |
| Title too generic              | Weak trend signal             | Add sample topic examples                 |
| Rationale missing              | Model trimmed output          | Increase `maxOutputTokens` slightly       |
| Schema parse errors            | Formatting drift              | Enforce double-quote JSON and no Markdown |

---

## **Pro Practices / Enhancements**

* Include mini few-shot samples for quality control.
* Keep temperature low for deterministic ranking.
* Use similarity scoring to detect duplicate seeds across rounds.
* Capture the model’s internal ranking explanation for future analytics.
* Blacklist previously used titles to prevent redundancy.
