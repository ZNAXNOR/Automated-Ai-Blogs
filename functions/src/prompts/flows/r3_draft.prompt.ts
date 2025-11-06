import {ai} from "../../clients/genkitInstance.client.js";
import {z} from "zod";
import {r3DraftOutput} from "../../schemas/flows/r3_draft.schema.js";

export const draftPrompt = ai.definePrompt({
  name: "Round3_DraftPrompt",
  description: "Compiles section drafts into a cohesive, full blog draft.",
  model: "googleai/gemini-2.0-flash",
  input: {
    schema: z.object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      sections: z.array(
        z.object({
          sectionId: z.string(),
          heading: z.string(),
          content: z.string(),
        })
      ),
      outline: z.any().optional(), // optional for reference
      researchNotes: z.any().optional(),
      description: z.string().optional(),
    }),
  },
  output: {
    schema: r3DraftOutput,
  },
  config: {
    temperature: 0.0,
    maxOutputTokens: 4096,
  },
  prompt: `
SYSTEM: You are a professional editor compiling multiple blog sections 
into a cohesive article.

INPUT:
- title: {{title}}
- subtitle: {{subtitle}}
- sections: {{sections}}
- outline: {{outline}}
- researchNotes: {{researchNotes}}

TASK:
1. Merge all sections into a single, polished blog draft.
2. Ensure smooth transitions between sections and maintain logical flow.
3. Keep tone professional, SEO-friendly, and factual.
4. Generate a short SEO-ready description summarizing the article.
5. Estimate reading time based on ~200 words per minute.
6. Maintain each section heading in the final draft.
7. Output JSON matching r3_draft_output schema:
   {
     "title": "...",
     "subtitle": "...",
     "sections": [ { "sectionId": "...", "heading": "...", "content": "..." } ],
     "description": "...",
     "readingTime": "...",
     "fullDraft": "..."
   }

IMPORTANT:
- Return ONLY valid JSON.
- Do NOT include Markdown, code fences (\`\`\`), or extra text.
- Strings must use double quotes only.
  `,
});
