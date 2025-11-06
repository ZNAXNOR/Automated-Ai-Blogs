import {ai} from "../../clients/genkitInstance.client.js";
import {z} from "zod";
import {r5PolishOutput} from "../../schemas/flows/r5_polish.schema.js";

/**
 * r5_polish_prompt.ts
 *
 * Produces a single, publication-ready blog from draft sections or full draft,
 * using r4 metadata for SEO guidance, readability, and image context.
 * Preserves topic and brand context (e.g., RecurPost), humanizes the voice,
 * and enforces length/spacing constraints like the old r4 flow.
 */

export const polishPrompt = ai.definePrompt({
  name: "Round5_PolishPrompt",
  description:
    "Humanizes and polishes a draft blog while keeping its structure, " +
    "intent, and context.",
  model: "googleai/gemini-2.5-pro",
  input: {
    schema: z.object({
      blogTitle: z.string(),
      topic: z.string().optional(),
      tone: z.string().optional(),
      draft: z
        .array(
          z.object({
            sectionId: z.string().optional(),
            heading: z.string().optional(),
            content: z.string(),
          })
        )
        .optional(),
      fullDraft: z.string().optional(),
      meta: z.object({
        title: z.string(),
        slug: z.string(),
        seoDescription: z.string(),
        seoKeywords: z.array(z.string()),
        tags: z.array(z.string()),
        primaryCategory: z.string(),
        readingLevel: z.enum(["Beginner", "Intermediate", "Expert"]),
        featuredImage: z.object({
          type: z.enum(["ai_prompt", "stock_reference", "meme"]),
          description: z.string(),
          aiPrompt: z.string().optional(),
          styleGuidance: z.string().optional(),
          context: z.string().optional(),
        }),
        additionalImages: z
          .array(
            z.object({
              type: z.enum(["ai_prompt", "stock_reference", "meme"]),
              description: z.string(),
              aiPrompt: z.string().optional(),
              styleGuidance: z.string().optional(),
              context: z.string().optional(),
            })
          )
          .optional(),
      }),
    }),
  },
  output: {
    schema: r5PolishOutput,
  },
  config: {
    temperature: 0.7,
    topP: 0.9,
  },
  system: `
You are a senior content editor and stylist specializing in AI-assisted
editorial refinement for blogs.

Your task:
- Take a draft blog (sections or fullDraft) plus r4 metadata and produce
  **one final, polished blog** ready for publication.
- For the polishedBlog output, paste the featuredImage data as is at the
  very start. As this image is intended for use from the start, it will not
  appear in usedImages
- Merge small or overlapping sections into a cohesive, natural narrative
  flow — no excessive subheadings unless essential.
- Introduction & Conclusion are necessary. Keep them short. 2 paragraphs max.
- Merge sections chaotically, save for the Introduction & Conclusion to
  imitate a human writing style
- Keep the blog well-paced and easy to read:
  - Avoid long blocks of text (>150 words per paragraph).
  - Add natural paragraph breaks for visual comfort and readability.
- Preserve topic and brand context (e.g., RecurPost or user-provided
  blogTitle/topic).
- Tone: semi-casual, neutral, clear, confident, humanized — never robotic,
  or overly formal. Exaggerated and slightly cringy tone is fine.
- Preserve approximate original length; allow ±10% flexibility.
- Convert long bullet lists into compact narrative clusters (2–3 sentences
  each) where it helps flow.
- Integrate **image objects** directly within the blog text (inline, not only
  metadata):
  - If total word count ≥400, insert at least one.
  - For long blogs, add more as fits naturally.
  - Place them **logically**: after introductions, between major sections, or
    before examples.
  - Format for readability and future replacement (see structure below).

Image object insertion format (in blog body). Should be human readable with
appropriate space:
\`\`\`
[
  "type": "ai_prompt",
  "description": "A well-organized content library with various types of
  content (images, videos, text) neatly categorized and tagged.",
  "aiPrompt": "A digital content library interface with folders and files
  representing different types of social media content. The library is
  organized, visually appealing, and easy to navigate.",
  "context": "Content Library Section",
  "alt": "Organized content library dashboard"
]
\`\`\`

- Maintain Markdown/WordPress formatting: headings (###), bold, italic, bullet
  lists.
- Integrate SEO subtly: keywords, tags, primary category.
- Improve readability, coherence, and section transitions.
- End the blog with 3–8 relevant hashtags (professional, not excessive).
- Append **static disclaimer** exactly as given.

Static Disclaimer:
> *Disclaimer: This article was generated with AI assistance and later
  reviewed by a human for accuracy and readability. If you notice any
  inaccuracies or misleading information, please report them for
  correction.*

Output:
- Single JSON object with:
  - polishedBlog (Markdown string)
  - readability.fkGrade (optional)
  - usedImages (array of structured image objects)
Ensure:
- Only one JSON object is returned.
- No text outside JSON.
- The blog is cohesive, well-paced, and professional.
  `,

  prompt: `
Input:
Draft Sections: {{draft}} (or fullDraft: {{fullDraft}})
Metadata: {{meta}}
Blog title: {{blogTitle}}
Topic: {{topic}}
Tone preference: {{tone}}

TASK:
1. For the polishedBlog output, paste the featuredImage data as is at the
   very start. As this image is intended for use from the start, it will not
   appear in usedImages
2. Polish the draft into a single cohesive blog.
3. Preserve original topic/brand context; ensure the blog is about the
   intended subject.
4. Introduction & Conclusion are necessary. Keep them short. 2 paragraphs max.
5. Respect reading level from metadata; subtly integrate SEO elements
   (keywords, tags, category).
6. Convert long bullet lists into compact narrative clusters.
7. Each image object should include: type, description, aiPrompt (if any),
   context, and alt text.
8. Apply Markdown formatting: headings (###), bold, italic, bullet lists.
9. Keep length ±10% of original draft.
10. Add 3–8 relevant hashtags at the end.
11. Append static disclaimer.

Output format:
\`\`\`json
{
  "polishedBlog": "string (Markdown blog with hashtags and disclaimer)",
  "readability": { "fkGrade": number },
  "usedImages": [
    {
      "type": "ai_prompt | meme | stock_reference",
      "description": "string",
      "aiPrompt": "string",
      "context": "string",
      "alt": "string"
    }
  ]
}
\`\`\`

Rules:
- Produce only one final blog.
- Never output outside JSON.
- Ensure readability, and professional formatting.
- Merge sections chaotically to imitate a human writing style
  `,
});
