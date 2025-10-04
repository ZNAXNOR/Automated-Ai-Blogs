# Round 7 — Publish to WordPress

## Purpose / Role  
Convert polished content + metadata into a full post on your WordPress site (draft or published). This is your final step. It wraps HTML assembly, metadata insertion, invitation for review, and remote API call.

## Interface  

| Input | Type | Description |
|---|---|---|
| `polished: PolishedSection[]` | content sections | Polished content |
| `meta: Metadata` | metadata | SEO and image prompt info |
| → returns | `{ wpPostId?: number; link?: string }` | id and URL or error |

Persist to `artifacts.round7` (and also `drafts/{draftId}` or similar).

## MVP Behavior  

- Assemble HTML or markdown: H1 = `meta.seoTitle`, H2 per section heading, insert content paragraphs.  
- Append a “References” section linking to citation placeholders.  
- Use your WordPress REST API client to `POST /wp/v2/posts` with `status: draft`.  
- Include metadata fields (tags, slug, meta fields).  
- Return the API response (postId, link).  
- Log API errors and retry (exponential backoff).  

## Refined / Advanced Goals  

- Optionally auto-publish (if coherence high) or queue for human review.  
- Upload a featured image (once generated) and attach to post.  
- Insert internal links (crossposts) or context interlinks.  
- Implement idempotency: if run re-executed, detect existing post and update instead of duplicate.  
- Validate post slug conflict handling.  
- Expose API callback / webhook on publish success.  
- Provide staging vs production WP environments.

## Common Failure Modes & Diagnostics  

| Symptom | Cause | Fix |
|---|---|---|
| WP returns HTTP error (401, 403, 500) | bad credentials, missing permissions, endpoint error | Inspect HTTP error body, verify Application Password, check endpoint URL |
| JSON response unexpected or missing ID | API changed, wrong endpoint | Log full response, inspect WP REST API docs |
| Post created but no content / blank | payload malformed | Log payload, verify fields (title, content) |
| Duplicate posts (rerun) | no idempotency | Use `runId` or hash to detect existing post |
| Slow requests / timeouts | large content | Chunk or reduce payload size, increase timeout, send only necessary fields |

## Pro Practices / Enhancements  

- Use WP Application Passwords (short-lived, scoped) and rotate regularly.  
- Wrap client calls with retries and circuit breakers.  
- Use a staging WP or preview environment first.  
- After initial publish, schedule a re-check of the post (e.g. verify metadata, SEO audit).  
- Log full request/response in structured logs (but redact secrets).  
- Provide an editing UI / admin dashboard that shows “drafts pending review.”  
- Support update / patch rather than always creating new.

## When It Goes Wrong — Questions to Ask  
1. What did WP API return (code, body)?  
2. Did your post payload include tags, slug, and content correctly?  
3. Was the post created already (duplicate)?  
4. Did content appear on WP site or is it missing?  
5. Are meta fields saved (check through WP admin)?  
