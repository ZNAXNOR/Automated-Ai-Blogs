import { ai } from "@src/clients/genkitInstance.client";
import { polishPrompt } from "@src/prompts/flows/r5_polish.prompt";
import { r5_polish_input, r5_polish_output } from "@src/schemas/flows/r5_polish.schema";
import { safeParseJsonFromAI } from "@src/clients/aiParsing.client";
import { z } from "zod";

console.log("[r5_polish]      Flow module loaded");

export const r5_polish = ai.defineFlow(
  {
    name: "Round5_Polish",
    inputSchema: r5_polish_input,
    outputSchema: r5_polish_output,
  },
  async (input) => {
    // Safely resolve title/topic
    const blogTitle = input.blogTitle ?? input.meta?.title ?? "Untitled Blog";
    const topic = input.topic ?? blogTitle;
    console.log(`[r5_polish] Flow invoked for: "${blogTitle}"`);

    let parsed: z.infer<typeof r5_polish_output> | null = null;
    let attempt = 0;
    const maxRetries = 2;

    // Merge section drafts if provided, else fallback to full draft
    const draftText =
      input.fullDraft ??
      input.draft
        ?.map((s) => (s.heading ? `${s.heading}\n${s.content}` : s.content))
        .join("\n\n") ??
      "";

    while (attempt <= maxRetries && !parsed) {
      attempt++;
      try {
        const llmResponse = await polishPrompt({
          blogTitle,
          topic,
          tone: input.tone,
          fullDraft: draftText,
          meta: input.meta,
        });

        const rawResponse = llmResponse.text;
        console.log(`[r5_polish] Raw AI response (attempt ${attempt}):`, rawResponse);

        parsed = safeParseJsonFromAI(rawResponse) as z.infer<typeof r5_polish_output>;

        if (!parsed) {
          console.warn(`[r5_polish] Invalid JSON output (attempt ${attempt})`);
        }
      } catch (err) {
        console.error(`[r5_polish] Error parsing AI response (attempt ${attempt}):`, err);
      }
    }

    if (parsed && (!parsed.usedImages || parsed.usedImages.length === 0)) {
        console.warn("[r5_polish] No images were used in output");
    }

    // Fallback in case parsing fails
    if (!parsed) {
      console.warn("[r5_polish] Fallback: using raw input as polished output");
      parsed = {
        polishedBlog: draftText,
        readability: { fkGrade: 55 },
      };
    }

    console.log(`[r5_polish] Completed successfully for "${blogTitle}"`);
    return parsed;
  }
);
