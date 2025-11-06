import {ai} from "../../clients/genkitInstance.client.js";
import {z} from "zod";
import {r3SectionOutput} from "../../schemas/flows/r3_draft.schema.js";

export const draftSectionPrompt = ai.definePrompt({
  name: "Round3_SectionDraftPrompt",
  description: "Generates a single blog section from heading, " +
  "bullets, and context.",
  model: "googleai/gemini-1.5-flash",
  input: {
    schema: z.object({
      sectionId: z.string(),
      heading: z.string(),
      bullets: z.array(z.string()).optional(),
      estWords: z.number().optional(),
    }),
  },
  output: {
    schema: r3SectionOutput,
  },
  config: {
    temperature: 0.2,
    maxOutputTokens: 800,
  },
  prompt: "SYSTEM: You are a professional blog writer creating one " +
"section of a blog using structured research.\n\n" +
"INPUT:\n" +
"- sectionId: {{sectionId}}\n" +
"- heading: {{heading}}\n" +
"- bullets: {{bullets}}\n" +
"- estWords: {{estWords}}\n\n" +
"CONTEXT:\n" +
"Use the flow context 'r3_draft_context' containing the full outline " +
"and validated research notes. Include relevant facts and examples " +
"from the research if available.\n\n" +
"TASK:\n" +
"- Write a cohesive, factual, and SEO-friendly section paragraph.\n" +
"- Respect the estimated word count ({{estWords}}).\n" +
"- Keep tone professional, informative, and concise.\n" +
"- Output ONLY a JSON object matching:\n" +
"  { \"sectionId\": \"...\", \"heading\": \"...\", \"content\": \"...\" }\n\n" +
"IMPORTANT:\n" +
"- No Markdown, code fences, or extra text.\n" +
"- Strings must use double quotes.",
});
