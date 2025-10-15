import { ai } from '../clients/genkitInstance.client';
import { z } from 'zod';
import { r2_angle_output } from '../schemas/flows/r2_angle.schema';

export const outlinePrompt = ai.definePrompt({
  name: 'Round2_AnglePrompt',
  description: 'Creates a detailed blog post outline from a topic idea.',
  model: 'googleai/gemini-2.0-flash',
  input: {
    schema: z.object({
      topicIdea: z.any(), // array of ideas, flexible
    }),
  },
  output: {
    schema: r2_angle_output,
  },
  config: {
    temperature: 0.0,
    // maxOutputTokens: 2048,
  },
  prompt: `
SYSTEM: You are a technical editor who builds structured blog outlines from topic ideas.

TASK:
Using TOPIC_IDEA, create a detailed outline for a blog post with:
- 5–8 main sections (each with an id, heading, and 3–5 bullet points)
- Approximate word counts per section
- A short introduction (s1) and a short conclusion (last section)

STYLE:
Clear, scannable, educational, and well-balanced across sections.

IMPORTANT OUTPUT RULES:
- Return ONLY a valid JSON object matching the schema below.
- Do NOT include any Markdown formatting, code fences (\`\`\`), or explanations.
- Strings must use double quotes only.
- Section IDs must follow the pattern "s1", "s2", etc.
- If input is unclear, return an empty JSON object in the same schema shape.

INPUT/TOPIC_IDEA:
{{topicIdea}}
  `,
});
