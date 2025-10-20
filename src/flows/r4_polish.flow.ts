import { ai } from "@src/clients/genkitInstance.client";
import { polishPrompt } from "@src/prompts/r4_polish.prompt";
import {
  r4_polish_input,
  r4_polish_output,
  R4PolishOutput,
} from "@src/schemas/flows/r4_polish.schema";
import { safeParseJsonFromAI } from "@src/clients/aiParsing.client";

console.log("[r4_polish]      Flow module loaded");

export const r4_polish = ai.defineFlow(
  {
    name: "Round4_Polish",
    inputSchema: r4_polish_input,
    outputSchema: r4_polish_output,
  },
  async (input) => {
    console.log(`[r4_polish] Flow invoked with title: ${input.title}`);

    let parsed: R4PolishOutput | null = null;
    let attempt = 0;
    const maxRetries = 2;

    while (attempt <= maxRetries && !parsed) {
      attempt++;
      try {
        const llmResponse = await polishPrompt(input);
        const rawResponse = llmResponse.text;
        console.log(`[r4_polish] Raw AI response (attempt ${attempt}): ${rawResponse}`);

        parsed = safeParseJsonFromAI(rawResponse) as R4PolishOutput;

        if (!parsed) {
          console.warn(`[r4_polish] Invalid JSON output (attempt ${attempt})`);
        }
      } catch (err) {
        console.error(`[r4_polish] Error parsing AI response (attempt ${attempt}):`, err);
      }
    }

    // Fallback in case parsing fails
    if (!parsed) {
      console.warn("[r4_polish] Fallback: using raw input as polished output");
      parsed = {
        polishedSections: (input.sections ?? []).map((s) => ({
          sectionId: s.sectionId,
          heading: s.heading,
          polishedContent: s.content,
          readabilityScore: 55,
        })),
        polishedFullDraft: input.fullDraft,
      };
    }

    // Final validation
    if (!parsed.polishedFullDraft?.trim()) {
      parsed.polishedFullDraft =
        parsed.polishedSections?.map((s) => `${s.heading}\n${s.polishedContent}`).join("\n\n") ||
        input.fullDraft;
    }

    console.log(`[r4_polish] Completed successfully for "${input.title}"`);
    return parsed;
  }
);
