# Round 2 — Outline Generation

## Purpose / Role  
Convert one `TopicIdea` into a structured outline: a table of contents, headings, bullets, and estimated word counts. This becomes the scaffold for content drafting and polishing.

## Interface  

| Input | Type | Description |
|---|---|---|
| `idea: TopicIdea` | one idea | The chosen topic for which to generate outline |
| → returns | `Outline` | With fields `title` and `sections: OutlineSection[]` |

Persist to `artifacts.round2`.

## MVP Behavior  

- Prompt a model (Phi-3 Mini or equivalent) to produce 5–8 sections, each with bullets and an estimate.  
- Enforce presence of *Introduction* and *Conclusion* sections.  
- Bullets should be actionable subtopics (3–5 per section).  
- Estimated words: e.g. 100–200 per section.

## Refined / Advanced Goals  

- Adjust section lengths based on relative importance (e.g. 250 words for core sections).  
- Annotate each bullet or heading with upstream trend tags or keywords.  
- Optionally provide “default CTA / interlink section” placements.  
- Provide alternative outline variants (e.g. shorter vs long-form).  
- Validate outline coherence (embedding similarity between adjacent sections less than threshold).  
- Score “balance” of sections (not too many bullet-heavy, not too shallow).

## Common Failure Modes & Diagnostics  

| Symptom | Cause | Fix |
|---|---|---|
| Too many sections or too granular | prompt is too lax | Enforce “5–8 sections, each ~ 3 bullets” in prompt |
| Bullets are repetitive / overlapping | no bullet-level dedupe | Post-process duplicate bullet detection |
| Poor heading hierarchy (skips levels) | model prompt ambiguous | Add constraints “don’t skip heading levels” |
| Estimations missing or unreasonable | prompt oversight | Add “must supply estWords” requirement |

## Pro Practices / Enhancements  

- Use few-shot examples (topic → outline) in prompt.  
- Validate bullets semantically (use embedding similarity between bullet and heading).  
- Allow manual editing / override of outline before drafting.  
- Generate outline variants (topic-angle A vs B) side by side.  
- Allow optional “sidebar” or “callout” sections for definitions, examples, FAQs.

## When It Goes Wrong — Questions to Ask  
1. Did the model return the expected JSON schema?  
2. Are section headings too shallow (1–2 words) or too verbose?  
3. Do bullets meaningfully extend headings or repeat content?  
4. Are estimated word counts realistic?  
5. Does the outline roughly match your expectation for content depth & breadth?  
