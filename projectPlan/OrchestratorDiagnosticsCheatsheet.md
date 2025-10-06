### Orchestrator Diagnostic & Temperature Cheat Sheet

This document provides a round-by-round reference for the AI blog generation orchestrator, including temperature settings, structured vs creative classification, and recommended diagnostic logging.

| Round | Flow File      | Purpose                                                       | Structured / Creative | Recommended Temperature | Diagnostic Logging Suggestion                                                        |
| ----- | -------------- | ------------------------------------------------------------- | --------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| r0    | `r0_trends`    | Fetch trending topics from SERPAPI                            | Structured            | 0.0                     | Log the full response: `console.log('[r0_trends] output:', r0)`                      |
| r1    | `r1_ideate`    | Generate 3–5 blog ideas with rationales                       | Creative              | 0.4–0.5                 | Log seed input and parsed output: `console.log('[r1_ideate] output:', r1)`           |
| r2    | `r2_outline`   | Build structured blog outline                                 | Structured            | 0.0                     | Log input JSON and output: `console.log('[r2_outline] output:', r2)`                 |
| r3    | `r3_draft`     | Expand outline into draft sections                            | Structured            | 0.0                     | Log section content length and sample: `console.log('[r3_draft] output:', r3)`       |
| r4    | `r4_polish`    | Enforce brand voice and readability                           | Structured            | 0.0                     | Log polished output: `console.log('[r4_polish] output:', r4)`                        |
| r5    | `r5_meta`      | Generate SEO title, meta description, tags, and image prompts | Structured            | 0.0                     | Log meta and images arrays: `console.log('[r5_meta] output:', r5)`                   |
| r6    | `r6_coherence` | Analyze coherence, duplication, and notes                     | Structured            | 0.0                     | Log overall score and duplicate matches: `console.log('[r6_coherence] output:', r6)` |
| r7    | `r7_publish`   | Publish draft to WordPress (or return draft info)             | Structured / I/O      | N/A (no LLM)            | Log WP response ID, link, and status: `console.log('[r7_publish] output:', wp)`      |

---

**Key Takeaways:**

1. **Structured rounds (r2–r6)**: temperature 0.0 ensures JSON consistency and schema compliance.
2. **Creative rounds (r1)**: slightly higher temperature allows diversity in ideas.
3. **Diagnostics logging:** always log input and output; wrap JSON parsing in try/catch to capture raw LLM output if parsing fails.
4. **Optional enhancements:** log round execution time; include round identifiers for traceability.
