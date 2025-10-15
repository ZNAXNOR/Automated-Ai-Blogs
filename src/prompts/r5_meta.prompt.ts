// src/prompts/r5_meta.prompt.ts
import { ai } from '../clients/genkitInstance.client';
import { z } from 'zod';
import { r5_meta_output } from '../schemas/flows/r5_meta.schema';

export const metaPrompt = ai.definePrompt({
  name: 'Round5_MetadataPrompt',
  description: 'Generates SEO metadata and image generation prompts for a blog post.',
  model: 'googleai/gemini-2.0-flash',
  input: {
    schema: z.object({
      polished: z.array(
        z.object({
          sectionId: z.string(),
          content: z.string(),
        })
      ),
    }),
  },
  output: {
    schema: r5_meta_output
  },
  config: {
    temperature: 0.55,
    maxOutputTokens: 2048,
  },
  prompt: `
SYSTEM: You are an SEO and art-direction assistant.

TASKS:
1) Create metadata for the given blog post:
   - SEO title (<= 60 characters)
   - Meta description (140–160 characters)
   - Slug (lowercase, hyphen-separated)
   - 6–10 keyword tags
2) Suggest 2–3 image generation prompts for cover or inline visuals.
   - Each image object must include: prompt, negative prompts, and alt text.
   - Prompts should specify lighting, composition, and style (e.g., photorealistic or illustration).

STYLE:
- The tone should match the brand’s educational, entertaining personality.
- Avoid clickbait or exaggerated claims.
- Use factual, keyword-rich phrasing that would perform well in search results.

IMPORTANT OUTPUT RULES:
- Return ONLY valid JSON exactly matching the schema below.
- Do NOT include Markdown, code fences (\`\`\`), or extra commentary.
- Strings must use double quotes only.
- If uncertain, make your best reasonable assumption and fill all fields. Never leave fields empty — use placeholders if absolutely necessary.

INPUT/POLISHED:
{{polished}}
`,
});
