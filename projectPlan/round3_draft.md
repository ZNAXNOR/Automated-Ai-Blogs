# Round 3 — Section Drafting

## Purpose / Role  
Expand each section from the outline into draft content. This is the meat of the article: you convert headings + bullets into full paragraphs with supporting statements and citation placeholders.

## Interface  

| Input | Type | Description |
|---|---|---|
| `outline: Outline` | object | The outline produced earlier |
| → returns | `SectionDraft[]` | Array of drafts, each with `sectionId` and `contentHtml` and `citations` |

Persist to `artifacts.round3`.

## MVP Behavior  

- For each `OutlineSection`, prompt LLM to produce 120–220 words of content in HTML (or markdown) form.  
- Ensure short paragraphs, inline citation placeholders `[1]`, `[2]`, etc., where facts need support.  
- Do not invent new facts; stick to what can be inferred or is general knowledge.  
- Respect ordering and section IDs.

## Refined / Advanced Goals  

- For each section, optionally ingest “source snippets” (from cluster articles) into prompt to ground content.  
- Use chain-of-thought instructions (e.g. “think step by step”) to help the model reason before writing.  
- Maintain internal coherence: refer to previous section context when needed.  
- Detect when content is too short or too verbose and trigger re-generation.  
- Provide “gap detection” (if section is missing subtopics) and request expansion.  
- Integrate shadow citations (e.g. “Citation A → placeholder → actual URL later”).  
- Optionally split very large sections into sub-sections automatically.

## Common Failure Modes & Diagnostics  

| Symptom | Cause | Remedy |
|---|---|---|
| Gibberish / nonsense text | model hallucination, prompt misformatted | Use more context, lower temperature, stronger instructions |
| Empty or overly short content | prompt too constrained | Increase min word requirement or relax constraints |
| Facts incorrect or invented | no grounding | Provide source snippets or require “only state well-known facts” |
| Missing section coverage | bullet not addressed | Add bullet-check post-pass to ensure coverage |
| Citation placeholders missing | prompt didn’t enforce | Require “provide [1], [2], etc.” in prompt explicitly |

## Pro Practices / Enhancements  

- Provide a “source buffer” — include 1–2 sentences from input cluster as context in prompt to reduce hallucination.  
- Use multi-turn prompting: first “reason outline → content plan,” then expand.  
- Use content filters / classifiers (e.g. factuality checks) and reject if quality low.  
- Optionally parallelize drafts (parallel calls per section).  
- After drafting, run a coherence step within the draft (embedding compare section to outline, etc.).  
- Use a “draft confidence” score or quality metric (e.g. perplexity, classifier).

## When It Goes Wrong — Questions to Ask  
1. Did the LLM return valid JSON / expected format?  
2. Are paragraphs coherent or do they drift off topic?  
3. Did every bullet get coverage or was any ignored?  
4. Are citations present (if required)?  
5. Did you see hallucinations (nonsense claims)? If yes, reduce temperature or add grounding.  
6. Compare semantic similarity between section draft and outline heading — is it too low?  
