
.# Round 5 — Tone Polishing

## Purpose / Role  
Take the rough drafts and polish them to your brand voice: ensure readability, consistency, stylistic tone, grammar, flow, while preserving factual statements and citation placeholders.

## Interface  

| Input                    | Type                | Description                                                           |
| ------------------------ | ------------------- | --------------------------------------------------------------------- |
| `drafts: SectionDraft[]` | array               | Draft content from Round 4 (meta)                                     |
| `brandVoice: string`     | string              | Description of your voice (e.g. “practical, authoritative, friendly”) |
| → returns                | `PolishedSection[]` | Polished sections with optional readability metrics                   |

Persist to `artifacts.round5`.

## MVP Behavior  

- Prompt model (LLaMA 3.1) with instructions: rewrite for voice, maintain meaning, preserve citations.  
- Ensure output is HTML (or markdown) structure consistent with input.  
- Return readability measure (e.g. Flesch-Kincaid Grade).  

## Refined / Advanced Goals  

- Multi-pass polishing: macro (flow, coherence) then micro (grammar, transitions).  
- Detect & fix run-on sentences, passive voice, length variety.  
- Maintain internal consistency (e.g., voice, pronouns, terms).  
- Optionally, pass through Rephrasy.ai (or a humanization model) with strict constraints (no fact changes).  
- Provide delta diagnostics (e.g. changed words, readability improvement).  
- Add “style suggestions” (e.g. flagged passive voice, too many adverbs) as metadata.

## Common Failure Modes & Diagnostics  

| Symptom                                            | Cause                              | Fix                                                             |
| -------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| Polished content changes facts / deletes citations | prompt too permissive              | Add “do not change facts or citations” guard in prompt          |
| Output very similar to draft (no polish)           | model reluctant                    | Increase temperature slightly or add more instructions/examples |
| Readability score too high / low                   | prompt not guiding transformations | Include target readability range in prompt                      |
| Inconsistent voice across sections                 | lack of global context             | Pass brandVoice and entire draft context to prompt              |

## Pro Practices / Enhancements  

- Supply few-shot before/after style examples in prompt.  
- Use automated linting (grammar, passive voice, transitions) post-run.  
- Provide a side-by-side diff for review.  
- Use “micro-edits” (you may want the model to mark what changed).  
- Maintain a “style guide snippet” (e.g. glossary, tone rules, banned words) the model refers to.

## When It Goes Wrong — Questions to Ask  
1. Did model preserve all citation placeholders intact?  
2. Are fact statements altered or removed?  
3. Is voice consistent across sections?  
4. Did readability improve (compute metric)?  
5. Any weird stylistic anomalies (jargon, repetitions)?  
