# Round 5 — Metadata & Image Prompt Generation

## Purpose / Role  
Generate SEO metadata (title, description, slug, tags) and art/illustration prompts. These drive SEO performance, image generation, and downstream publishing.

## Interface  

| Input | Type | Description |
|---|---|---|
| `title: string` | main title | From outline or ideation |
| `polished: PolishedSection[]` | sections | Polished content |
| → returns | `Metadata` | includes `seoTitle`, `metaDescription`, `slug`, `tags`, and optionally `imagePrompts` |

Persist to `artifacts.round5`.

## MVP Behavior  

- Prompt model (Gemma / TinyLlama) to produce:  
  • SEO title (≤ 60 characters)  
  • Meta description (140–160 characters)  
  • Slug (URL-friendly)  
  • 5–7 keyword tags  
- Also, ask for 1–2 image prompts (hero image + inline) with `altText`.

## Refined / Advanced Goals  

- Rank tags by search volume or relevance.  
- Suggest image prompt variants (e.g. illustration, photorealistic).  
- Provide recommended image aspect ratio or style (e.g. “flat design, tech style, soft colors”).  
- Validate slug uniqueness (check existing WP slugs via API).  
- Suggest interlinking or “pillar links” in metadata.  
- Return recommended meta robots or canonical tags if needed.

## Common Failure Modes & Diagnostics  

| Symptom | Cause | Remedy |
|---|---|---|
| SEO title too long / generic | model not constrained | Enforce length in prompt with examples |
| Meta description missing or too brief | prompt omission | Add “must be 140–160 characters” requirement |
| Tags too generic or irrelevant | prompt lacks specificity | Ask “tags drawn from content topics” |
| Image prompts off-topic or vague | prompt too open | Include style, mood, reference context in prompt |
| Slug conflicts on WP | slug not unique | Optionally check WP and re-prompt slug variation |

## Pro Practices / Enhancements  

- Use a small keyword tool or API (e.g. Ubersuggest, Google Keyword Planner) to validate or augment tags.  
- Use term frequency from polished content to seed tag suggestions.  
- Add fallback logic: if image prompt fails, use title + primary tag as prompt.  
- Compute “SEO score” (readability, keyword density) as metadata.  
- Generate “open graph image prompt” variant.  
- Integrate with image generation service (DALL·E, Stable Diffusion) downstream.

## When It Goes Wrong — Questions to Ask  
1. Does the SEO title include key terms and stay under 60 chars?  
2. Is the meta description concise, descriptive, and within length limits?  
3. Do tags reflect actual topics from the content?  
4. Are image prompts coherent and relevant?  
5. Is slug URL-safe and not conflicting with existing posts?  
