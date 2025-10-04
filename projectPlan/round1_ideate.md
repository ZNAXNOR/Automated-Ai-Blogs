# Round 1 — Topic Ideation

## Purpose / Role  
Transform trend signals into a small set (3–5) of candidate blog post ideas. Each idea includes a title, rationale, and a primary keyword. This is your “filtering and framing” stage before deeper content work.

## Interface  

| Input | Type | Description |
|---|---|---|
| `trendItems: TrendItem[]` | array | Signals from Round 0 |
| → returns | `TopicIdea[]` | Candidate topic ideas, each with `title`, `rationale`, `primaryKeyword`, `seed` |

Persist to `artifacts.round1`.

## MVP Behavior  

- Prompt a small LLM (TinyLlama, or even a small HF model) with the trend items.  
- Ask for 3–5 titles + rationales.  
- Ensure titles contain at least one seed or trend keyword.  
- Ensure rationales include a `[source?]` placeholder for citation logic.  
- Basic dedupe: titles must differ significantly (e.g. Jaccard or embedding threshold).

## Refined / Advanced Goals  

- Score / rank ideas by likely search traffic, competition, or trend strength.  
- Include “intent type” metadata (e.g. tutorial, opinion, list).  
- Provide clustering of ideas (if two are very close).  
- Expand rationale with mini bullet points of “why now” factors.  
- Generate alternative phrasings / synonyms for title (for A/B).  
- Provide “title variants” (e.g. question form, list form).

## Common Failure Modes & Diagnostics  

| Symptom | Cause | Action |
|---|---|---|
| Titles too vague or generic | prompt poorly constrained | Add more instructions, examples, and constraints |
| Titles that don’t correlate with seeds/trends | model drift or weak input | Enforce “must include one keyword” constraint |
| Rationale is empty or generic | model failure or short prompt | Lower temperature, increase model capacity |
| Duplicate or overlapping ideas | no dedupe logic | Use embedding or fuzzy dedupe across titles |

## Pro Practices / Enhancements  

- Include negative examples (“not: clickbait, not too broad”) in prompts.  
- Use few-shot examples (2–3 good title/rationale pairs) in the prompt to guide format.  
- Automatically simulate click-through or query intent from titles (e.g. “Who would search this?”).  
- Let the ideation step reject seeds that are too weak (score below threshold).  
- Maintain a historical blacklist or archive of previously used titles to avoid duplication across runs.

## When It Goes Wrong — Questions to Ask  
1. Did the LLM respond with valid JSON? Did you parse it correctly?  
2. Are the titles too general (e.g. “AI Trends”) — can you restrict or re-prompt?  
3. Are you seeing repeated titles (embedding similarity)?  
4. Are the rationales meaningful or boilerplate — may need stronger prompt guidance.  
5. Do the outputs include seed keywords as expected?  
