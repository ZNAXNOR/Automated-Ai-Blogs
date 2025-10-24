import { ai } from '../clients/genkitInstance.client';
import {
  r3_draft_input,
  r3_draft_output,
  R3SectionInput,
  R3SectionOutput,
  R3DraftOutput,
} from '../schemas/flows/r3_draft.schema';
import { draftPrompt } from '../prompts/flows/r3_draft.prompt';
import { draftSectionPrompt } from '../prompts/flows/r3_draft_section.prompt';
import { safeParseJsonFromAI } from '../clients/aiParsing.client';

console.log(`[r3_draft]       Flow module loaded`);

export const r3_draft = ai.defineFlow(
  {
    name: 'Round3_Draft',
    inputSchema: r3_draft_input,
    outputSchema: r3_draft_output,
  },
  async (input, { context }) => {
    console.log({
      flow: 'r3_draft',
      stage: 'start',
      message: 'Flow invoked',
      input,
    });
    // context may include things like { angle, researchNotes, outline } if upstream passes them.

    const outline = input.outline ?? { title: null, sections: [] };
    const researchNotes = input.researchNotes ?? [];
    const subtitle = typeof input.subtitle === 'string' ? input.subtitle : undefined;
    const description = typeof input.description === 'string' ? input.description : undefined;

    if (!Array.isArray(outline.sections) || outline.sections.length === 0) {
      console.warn({
        flow: 'r3_draft',
        stage: 'validation',
        message: 'No sections found in outline, returning minimal draft',
        outline,
      });
      return {
        title: outline.title ?? 'Untitled Article',
        subtitle,
        sections: [],
        description: '',
        readingTime: '1 min',
        fullDraft: '',
      };
    }

    const sectionOutputs: R3SectionOutput[] = [];

    console.log({
      flow: 'r3_draft',
      stage: 'section_generation',
      message: `Generating ${outline.sections.length} sections...`,
      sectionCount: outline.sections.length,
    });

    for (const sec of outline.sections) {
      const sectionInput: R3SectionInput = {
        sectionId: sec.id,
        heading: sec.heading,
        bullets: sec.bullets ?? [],
        estWords: sec.estWords ?? 200,
      };

      try {
        console.log({
          flow: 'r3_draft',
          stage: 'section_prompt',
          message: `Running section prompt for ${sec.id} - "${sec.heading}"`,
          sectionId: sec.id,
          heading: sec.heading,
        });

        const sectionResp = await draftSectionPrompt(sectionInput, {
          context: {
            ...context,
            outline,
            researchNotes,
          },
        });

        const raw = sectionResp.text ?? JSON.stringify(sectionResp.output ?? {});
        console.log({
            flow: 'r3_draft',
            stage: 'section_prompt_response',
            message: `Raw response for section ${sec.id}`,
            sectionId: sec.id,
            raw,
        });
        const parsed = safeParseJsonFromAI(raw);

        sectionOutputs.push(parsed);
        console.log({
            flow: 'r3_draft',
            stage: 'section_complete',
            message: `✅ Section ${sec.id} completed`,
            sectionId: sec.id,
        });
      } catch (err) {
        console.error({
          flow: 'r3_draft',
          stage: 'section_generation_error',
          message: `Section ${sec.id} generation failed`,
          sectionId: sec.id,
          error: err instanceof Error ? err.stack : String(err),
        });
        sectionOutputs.push({
          sectionId: sec.id,
          heading: sec.heading,
          content: '(Section generation failed.)',
        });
      }
    }

    console.log({
        flow: 'r3_draft',
        stage: 'draft_compilation',
        message: 'All sections generated, compiling final draft',
        sectionCount: sectionOutputs.length,
    });

    const mainPromptInput = {
      title: outline.title ?? 'Untitled Article',
      subtitle,
      sections: sectionOutputs,
      outline,
      researchNotes,
      description,
    };

    let finalDraft: R3DraftOutput;
    try {
      console.log({
          flow: 'r3_draft',
          stage: 'main_prompt',
          message: 'Running main draft prompt to merge sections...',
      });
      console.log({
          flow: 'r3_draft',
          stage: 'main_prompt_input',
          message: 'Input for main draft prompt',
          mainPromptInput,
      });

      const resp = await draftPrompt(mainPromptInput, {
        context: {
          ...context,
          outline,
          researchNotes,
        },
      });

      const raw = resp.text ?? JSON.stringify(resp.output ?? {});
      console.log({
        flow: 'r3_draft',
        stage: 'main_prompt_response',
        message: 'Raw response from main draft prompt',
        raw,
      });

      finalDraft = safeParseJsonFromAI(raw);

      r3_draft_output.parse(finalDraft);
      console.log({
          flow: 'r3_draft',
          stage: 'validation_success',
          message: '✅ Final draft validated successfully'
      });
    } catch (err) {
      console.error({
        flow: 'r3_draft',
        stage: 'draft_compilation_error',
        message: 'Main draft prompt failed or schema validation failed',
        error: err instanceof Error ? err.stack : String(err),
      });
      const fullDraft = sectionOutputs.map((s) => `## ${s.heading}\n\n${s.content}`).join('\n\n');
      const wordCount = sectionOutputs.reduce((acc, s) => acc + s.content.split(/\s+/).length, 0);
      finalDraft = {
        title: outline.title ?? 'Untitled Article',
        subtitle,
        sections: sectionOutputs,
        description: description ??
          (sectionOutputs[0]?.content.split(' ').slice(0, 30).join(' ') + '...'),
        readingTime: `${Math.max(1, Math.round(wordCount / 200))} min`,
        fullDraft,
      };
      console.log({
          flow: 'r3_draft',
          stage: 'fallback_assembly',
          message: 'Fallback draft assembled'
      });
    }

    console.log({
        flow: 'r3_draft',
        stage: 'complete',
        message: 'Flow completed',
        finalDraft,
    });
    return finalDraft;
  }
);
