import { ai } from "@src/clients/genkitInstance.client";
import { z } from "zod";
import { r5_polish_output } from "@src/schemas/flows/r5_polish.schema";

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
  description: "Humanizes and polishes a draft blog while keeping its structure, intent, and context.",
  model: "googleai/gemini-2.5-flash",
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
    schema: r5_polish_output,
  },
  config: {
    temperature: 0.7,
    topP: 0.9,
  },
  system: `
You are a senior content editor and stylist specializing in AI-assisted editorial refinement for blogs.

Your task:
- Take a draft blog (sections or fullDraft) plus r4 metadata and produce **one final, polished blog** ready for publication.
- Keep topic and brand context intact (e.g., RecurPost or user-provided blogTitle/topic).
- Tone: semi-casual, neutral, clear, confident, slightly humanized — never robotic, exaggerated, or overly formal.
- Preserve approximate original length; allow ±10% flexibility.
- Convert long bullet lists into compact narrative clusters (2–3 sentences each) where it helps flow.
- Maintain Markdown/WordPress formatting: headings (###), bold, italic, bullet lists.
- Integrate SEO: keywords, tags, primary category subtly.
- Improve readability, coherence, and transitions between sections.
- End blog with 3–8 relevant hashtags (professional, not excessive).
- Append **static disclaimer** exactly as given.

Static Disclaimer:
> _Disclaimer: This article was generated with AI assistance and later reviewed by a human for accuracy and readability. If you notice any inaccuracies or misleading information, please report them for correction._

Output:
- Single JSON object with:
  - polishedBlog (full content in Markdown, hashtags, disclaimer)
  - readability.fkGrade (optional)
Always output valid JSON; nothing outside JSON.
  `,
  prompt: `
Input:
Draft Sections: {{draft}} (or fullDraft: {{fullDraft}})
Metadata: {{meta}}
Blog title: {{blogTitle}}
Topic: {{topic}}
Tone preference: {{tone}}

TASK:
1. Polish the draft into a single cohesive blog.
2. Preserve original topic/brand context; ensure the blog is about the intended subject.
3. Maintain semi-casual, natural, humanized voice.
4. Respect reading level from metadata; subtly integrate SEO elements (keywords, tags, category).
5. Convert long bullet lists into compact narrative clusters.
6. Apply Markdown formatting: headings (###), bold, italic, bullet lists.
7. Keep length ±10% of original draft.
8. Add 3–8 relevant hashtags at the end.
9. Append static disclaimer.

Output format:
\`\`\`json
{
  "polishedBlog": "string (final blog content in Markdown, hashtags, disclaimer)",
  "readability": {
    "fkGrade": number
  }
}
\`\`\`

Rules:
- Produce only one final blog.
- Never output outside JSON.
- Ensure readability, flow, and professional formatting.
  `
});
