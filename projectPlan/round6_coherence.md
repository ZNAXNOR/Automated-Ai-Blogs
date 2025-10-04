# Round 6 — Coherence & Duplication Checking

## Purpose / Role  
Assess the semantic coherence (how well sections align with whole) and guard against publishing near-duplicates using embeddings. This quality gate helps avoid gibberish or redundant content.

## Interface  

| Input | Type | Description |
|---|---|---|
| `polished: PolishedSection[]` | sections | All polished content |
| Optionally: `recentN: number` | int | Number of recent posts to check against |
| → returns | `CoherenceReport` | metrics and duplicate flags |

Also, write embedding vectors to `vectors/{hash}` for downstream use.

## MVP Behavior  

- Use embedding API (e.g. all-MiniLM) to embed **entire article** and **each section**.  
- Compute `overall = average cosine(sectionVec, fullArticleVec)`.  
- Compare full-article embedding to embeddings of recent N posts (from Firestore).  
- If any similarity ≥ `duplicateThreshold` (e.g. 0.92), mark as duplicate.  
- Return section-level scores and flags (e.g. “section s3 coherence low”).  

## Refined / Advanced Goals  

- Use an ANN index (e.g. HNSW, Faiss) for fast similarity queries at scale.  
- Flag individual sections whose cosine to full is below a threshold (e.g. <0.65).  
- Provide suggestion: “revise section X” or “merge sections Y/Z.”  
- Support partial republishing: skip low-coherence sections and regenerate.  
- Use embedding score weighting by section length.  
- Track embedding drift over time (monitor embedding stability).  
- Maintain dedup history / blacklist to avoid future generation of similar topics.

## Common Failure Modes & Diagnostics  

| Symptom | Cause | Diagnostic / Fix |
|---|---|---|
| Overall coherence very low (e.g. < 0.5) | drafts diverged or hallucinated content | Log section-level scores, re-run or regenerate drafts |
| Duplicate flagged for slight semantic overlap | threshold too low | Raise threshold or analyze false positives |
| Embedding service fails / times out | API error or model unavailable | Add fallback or retry logic |
| Vector storage collisions or overwrites | hash collision or bad keying | Use strong text hashing (sha256) plus runId in key |

## Pro Practices / Enhancements  

- Use hybrid embeddings (title + body) to improve detection.  
- Weight section coherence by word count (longer sections matter more).  
- Use clusters / nearest neighbor heuristics to avoid comparing to very distant posts.  
- Add “drift detection” alerts: if new post is semantically far from your content base, warn.  
- Provide visual embedding distance maps (t-SNE) for debugging.  
- Incorporate duplication in ideation: if idea is embedding-close to past post, discard early.

## When It Goes Wrong — Questions to Ask  
1. What are section-level coherence scores? Which sections are dragging down the average?  
2. Which existing post(s) triggered duplicate flag? Check similarity scores.  
3. Did embedding API return errors or out-of-domain vectors?  
4. Is your `recentN` window too small / too large?  
5. Is threshold parameter too strict or lenient?  
