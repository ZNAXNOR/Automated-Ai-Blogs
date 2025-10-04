# Pipeline Overview & Round Map

This document is your high-level reference: how the entire pipeline fits together, what each round does, and how data flows from input to published blog post.

---

## Pipeline Goals & High-Level Flow

You are building a **modular, AI-powered blog generation pipeline**. The goal is to go from seed ideas to published posts with minimal human overhead—while maintaining coherence, SEO quality, and deduplication safeguards.

Here’s the end-to-end flow:
```
Seeds/params → Round 0 → Round 1 → Round 2 → Round 3 → Round 4 → Round 5 → Round 6 → Round 7 → Published WP post
```


Below is a breakdown of each round, its responsibilities, input → output, and success criteria.

---

## Round 0 — Trend & Topic Input

- **Responsibility**: Gather external signals (autocomplete, trending topics, related queries, optionally RSS topics) given seed keywords/regions.  
- **Input**: `seeds`, `region`  
- **Output**: `TrendItem[]`  
- **Success Criteria**: You receive > 3–5 nontrivial TrendItems, deduped and normalized.  
- **Downstream Use**: Ideation (Round 1) draws from these to ground topics in what’s current.

---

## Round 1 — Topic Ideation

- **Responsibility**: From trend signals, generate 3–5 candidate blog ideas (title + rationale).  
- **Input**: `TrendItem[]`  
- **Output**: `TopicIdea[]`  
- **Success Criteria**: Titles are unique, include trend/seed keywords, rationales plausible.  
- **Downstream Use**: Choose one `TopicIdea` (or parallel run) as basis for outline.

---

## Round 2 — Outline Generation

- **Responsibility**: Build a structured scaffold (sections, bullets, word estimates).  
- **Input**: `TopicIdea`  
- **Output**: `Outline`  
- **Success Criteria**: Balanced sections (5–8), each with relevant bullets and estimated length.  
- **Downstream Use**: Guides section drafting (Round 3).

---

## Round 3 — Section Drafting

- **Responsibility**: Expand each outline section into content.  
- **Input**: `Outline`  
- **Output**: `SectionDraft[]`  
- **Success Criteria**: All bullets addressed, paragraphs coherent, citation placeholders included.  
- **Downstream Use**: Input to polishing (Round 4).

---

## Round 4 — Tone Polishing

- **Responsibility**: Rewrite drafts into your brand voice with clean readability.  
- **Input**: `SectionDraft[]` + `brandVoice`  
- **Output**: `PolishedSection[]`  
- **Success Criteria**: Readability improved, tone consistent, no fact changes, citations preserved.  
- **Downstream Use**: Content for metadata, coherence checking, and publishing.

---

## Round 5 — Metadata & Image Prompts

- **Responsibility**: Generate SEO metadata and creative image prompts.  
- **Input**: `title` + `PolishedSection[]`  
- **Output**: `Metadata` + optionally `imagePrompts`  
- **Success Criteria**: SEO title ≤60 chars, meta description 140–160, tags relevant, image prompts on-topic.  
- **Downstream Use**: WordPress publishing (slug, tags) and image generation subsystem.

---

## Round 6 — Coherence & Duplicate Checking

- **Responsibility**: Quality-gate the content; detect gibberish and duplicates.  
- **Input**: `PolishedSection[]`  
- **Output**: `CoherenceReport`  
- **Success Criteria**: Average section-to-article coherence ≥ threshold (e.g. ≥0.75), no existing duplicate flagged.  
- **Downstream Use**: Decide whether to proceed to publish or abort / send to human review.

---

## Round 7 — Publish to WordPress

- **Responsibility**: Assemble final HTML / post structure and send to WP API.  
- **Input**: `PolishedSection[]`, `Metadata`  
- **Output**: `{ wpPostId, link }`  
- **Success Criteria**: Post is created (or updated) as draft (or published), tags/meta fields applied, link returned.  
- **Downstream Use**: Final result; you may optionally trigger post-publish tasks (e.g. schedule images, analytics).

---

## Integration & Data Flow Notes

- **Idempotency**: Each round checks existence of `artifacts.round{i}` before execution.  
- **Failure Handling**: Round failures are caught and logged; orchestrator may abort or fallback.  
- **Diagnostics**: Each round logs timing, token usage, intermediate metrics to `runs/{runId}.diagnostics`.  
- **Caching / Persistence**:
  - Round 0 uses SerpApi cache in Firestore.  
  - Round 6 writes embeddings to `vectors` collection.  
  - Round 7 writes post metadata and links to persistent `drafts` collection.  
- **Branch Logic**: After Round 6, the coherence report may trigger a branch: auto-publish vs human review vs abort.  
- **Parallelism Option**: You may run multiple TopicIdea → downstream rounds in parallel (e.g. generate multiple drafts) and pick the best.

---

## How to Use This Overview

- When debugging or stuck, locate which round’s output or transformation seems wrong.  
- Check that the input and output contracts (types) hold for that round.  
- Refer to each round’s individual doc to see expected behavior, failure modes, and refinement paths.  
- Use this as a roadmap when adding features (e.g. alternate workflows, retries, human-in-loop steps).  

This overview plus per-round docs should serve as your source of truth and guardrails as you evolve the pipeline.  
