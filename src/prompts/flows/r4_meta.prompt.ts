import { ai } from '../../clients/genkitInstance.client';
import { z } from 'zod';
import { r4_meta_output } from '../../schemas/flows/r4_meta.schema';

export const metaPrompt = ai.definePrompt({
  name: 'Round4_MetaPrompt',
  description: 'Generates SEO metadata, keywords, and image guidance from the draft text.',
  model: 'googleai/gemini-2.0-flash',
  input: {
    schema: z.object({
      blogTitle: z.string(),
      draftText: z.string(),
      topic: z.string().optional(),
      tone: z.string().optional(),
      availableTags: z.array(z.string()).optional(),
      availableCategories: z.array(z.string()).optional(),
    }),
  },
  output: {
    schema: r4_meta_output,
  },
  config: {
    temperature: 0.3,
    maxOutputTokens: 900,
  },
  system: `
You are an SEO and content strategy expert specializing in metadata generation
for long-form blogs. You optimize visibility, CTR, and reader retention while
keeping authenticity intact.
  `,
  prompt: `
- blogTitle: {{blogTitle}}
- topic: {{topic}}
- tone: {{tone}}
- draftText: {{draftText}}

AVAILABLE TAGS: {{availableTags}}
AVAILABLE CATEGORIES: {{availableCategories}}

TASK:
Analyze the blog draft and output a single JSON object matching this schema:

{
  "title": "string (SEO-optimized, ≤60 chars)",
  "slug": "string (lowercase, hyphenated, keyword-rich)",
  "seoDescription": "string (≤155 chars summarizing main idea)",
  "seoKeywords": ["string", "string"],
  "tags": ["string" — must be chosen from availableTags],
  "primaryCategory": "string" — must be chosen from availableCategories,
  "readingLevel": "Beginner | Intermediate | Expert",
  "featuredImage": {
    "type": "ai_prompt | stock_reference | meme",
    "description": "string",
    "aiPrompt": "string",
    "styleGuidance": "string"
  },
  "additionalImages": [
    {
      "context": "section_title or concept",
      "type": "ai_prompt | stock_reference | meme",
      "description": "string",
      "aiPrompt": "string"
    }
  ]
}

GUIDELINES:
- Select tags and category strictly from provided lists.
- Use concise, human-attractive SEO title and slug.
- Derive keywords semantically from the draft.
- Reading level reflects complexity and tone.
- Image prompts should describe detailed visual scenes aligned with the topic.
- Output must be pure JSON, double-quoted, no markdown or comments.
  `,
});
