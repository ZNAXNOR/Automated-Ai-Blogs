# Round 0 — Trend & Topic Input

## Purpose / Role in Pipeline  
This is the entry point: gather external signals (search trends, autocomplete suggestions, related queries, optionally RSS feed topics) that inform topic ideation. It primes the rest of the pipeline with signal data rather than random topics.  

You use this to bias toward “what people care about now,” improving relevance and SEO potential.

## Interface  

| Name | Type | Description |
|---|---|---|
| `seeds: string[]` | array of seed terms | Keywords or topics to steer trend search |
| `region?: string` | string (optional) | Geographic or locale filter (e.g. “in”, “us”) |
| → returns | `TrendItem[]` | List of trend/autocomplete/related queries, each with metadata |

Each `TrendItem` might have fields like:
- `query` (string)  
- `type` (autocomplete / trending / related / rss)  
- `score` or weight  
- `source`  
- `ts` timestamp  

Also, this function should persist `artifacts.round0` in your run document / DB, and optionally cache the results to avoid repeated SerpApi calls.

## MVP Behavior  

- Call SerpApi (or equivalent trending API) with seed(s).  
- Optionally fetch autocomplete suggestions or related queries.  
- Return deduplicated list of trending queries.  
- Cache the raw SerpApi response or processed TrendItems with TTL (e.g. 24–48h) in Firestore under `cache/serpapi/{hash}`.  
- In case of API error or quota limit, fallback gracefully (e.g. return empty or minimal TrendItem list).  

## Refined / Advanced Goals  

- Merge signals from multiple sources: e.g. Google Trends API, YouTube trending, RSS popular topics, social media mentions.  
- Score or weight signals (e.g. by volume, recent rise, seasonality).  
- Filter / de-noise low volume or irrelevant signals.  
- Cluster or group very similar queries (e.g. “AI trends 2025” vs “2025 AI trends”) to reduce redundancy.  
- Provide metadata (e.g. monthly search volume, growth rate).  
- Provide “topic families” (super-queries + sub-queries).  
- Use embeddings to dedupe noisy duplicates.

## Common Failure Modes & Diagnostics  

| Symptom | Likely Cause | Diagnostic / Fix |
|---|---|---|
| No or too few trend items | API error, rate limit, incorrect seed | Inspect error logs, verify API key, test with simpler seeds |
| Duplicate / overlapping queries | No dedupe / normalization | Apply `normalize(lowercase, remove stop words, sort tokens)` + set dedupe threshold |
| Irrelevant or off-topic queries | Seeds too general, no filtering | Filter by domain, check keyword overlap with seed, prune by semantic closeness |
| Cache returns stale data | TTL not handled, no invalidation logic | Ensure `expiresAt` logic works; include timestamp and revalidate if too old |

## Pro Practices / Enhancements  

- Version the query hash scheme so cache shape changes don’t conflict.  
- Log API usage, counts of items, cache hit vs miss.  
- Maintain metrics: “unique trend items per seed,” “growth ratio.”  
- Build a mini UI or CLI to inspect recent trend items (for debugging).  
- Add fallback strategies (if SerpApi fails, fallback to Google autocomplete, or RSS trending).  
- If you support multiple locales, segment trends per region.

## When It Goes Wrong — Questions to Ask  
1. Did the SerpApi (or other trend API) return valid data? Check raw JSON.  
2. Are all trend items filtered / normalized? Maybe you passed empty seeds.  
3. Is caching working (are you reading stale or empty caches)?  
4. Are the returned queries too generic (e.g. “AI”) — maybe you need stricter filtering.  
5. Do your trend items align semantically with your seed space (embedding similarity)?  
