/**
 * @file Readability Evaluator
 * Estimates readability scores using APYHub API or heuristic fallback.
 */

import { z } from "zod";
import { ai } from "../clients/genkitInstance.client";
import {
  ReadabilityInput,
  ReadabilityResult,
  ReadabilityInputSchema,
} from "../schemas/evaluators/readability.schema";
import { clamp, wordCount, callApyhub } from "@utils/evaluator.util";

function gradeLabelFromFk(grade: number | null | undefined): string {
  if (grade == null || Number.isNaN(grade)) return "unknown";
  if (grade <= 5) return "Elementary";
  if (grade <= 8) return "Middle School";
  if (grade <= 12) return "High School";
  if (grade <= 16) return "College";
  return "Advanced";
}

export async function readabilityEvaluator(input: ReadabilityInput): Promise<ReadabilityResult> {
  console.log('[readabilityEvaluator] Starting evaluation with input length:', input?.text?.length ?? 0);
  const text = (input?.text ?? "").trim();
  if (!text) {
    console.log('[readabilityEvaluator] Empty text provided. Returning score 0.');
    return {
      score: 0,
      gradeLevel: "unknown",
      details: {},
      raw: { error: "empty_text" },
    };
  }

  // Attempt APYHub request
  const endpoint = "https://api.apyhub.com/utility/readability-scores";
  console.log('[readabilityEvaluator] Calling APYHub endpoint...');
  const apy = await callApyhub(endpoint, { text }, { timeoutMs: 8000 });

  if (apy.success && apy.data) {
    console.log('[readabilityEvaluator] APYHub call successful. Processing data...');
    const json: any = apy.data;
    const flesch = json.flesch_reading_ease ?? json.flesch ?? null;
    const fkGrade = json.flesch_kincaid_grade ?? json.flesch_kincaid ?? json.grade_level ?? null;
    const gunningFog = json.gunning_fog ?? null;
    const smog = json.smog ?? json.smog_index ?? null;
    
    console.log(`[readabilityEvaluator] APYHub scores: Flesch=${flesch}, FK Grade=${fkGrade}, Gunning Fog=${gunningFog}, SMOG=${smog}`);

    const normalized: number[] = [];

    if (typeof flesch === "number" && !Number.isNaN(flesch)) normalized.push(clamp(Math.round(flesch)));
    if (typeof fkGrade === "number" && !Number.isNaN(fkGrade)) normalized.push(clamp(100 - (fkGrade / 20) * 100));
    if (typeof gunningFog === "number" && !Number.isNaN(gunningFog))
      normalized.push(clamp(100 - ((gunningFog - 6) / 14) * 100));
    if (typeof smog === "number" && !Number.isNaN(smog)) normalized.push(clamp(100 - ((smog - 6) / 14) * 100));

    const readabilityScore =
      normalized.length > 0 ? Math.round(normalized.reduce((a, b) => a + b, 0) / normalized.length) : null;
    
    console.log(`[readabilityEvaluator] Normalized APYHub score: ${readabilityScore}`);

    const finalScore =
      readabilityScore != null ? clamp(readabilityScore) : clamp(Math.round(100 - Math.min(80, (wordCount(text) / 250) * 25)));

    const gradeLabel = gradeLabelFromFk(typeof fkGrade === "number" ? fkGrade : null);
    
    console.log(`[readabilityEvaluator] Final score: ${finalScore}, Grade: ${gradeLabel}`);

    return {
      score: finalScore,
      gradeLevel: gradeLabel,
      details: {
        flesch_kincaid: typeof fkGrade === "number" ? fkGrade : null,
        gunning_fog: typeof gunningFog === "number" ? gunningFog : null,
        smog_index: typeof smog === "number" ? smog : null,
      },
      raw: json,
    };
  }

  // Fallback heuristic
  console.warn('[readabilityEvaluator] APYHub call failed or returned no data. Using fallback heuristic.');
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const avgSentenceLen = sentences.length
    ? sentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / sentences.length
    : 0;
  const heuristicScore = clamp(Math.round(100 - ((avgSentenceLen - 8) / 20) * 80));
  const grade = avgSentenceLen < 10 ? "Middle School" : avgSentenceLen < 14 ? "High School" : "College";

  console.log(`[readabilityEvaluator] Fallback calculated score: ${heuristicScore}, Grade: ${grade}`);

  return {
    score: heuristicScore,
    gradeLevel: grade,
    details: { flesch_kincaid: null, gunning_fog: null, smog_index: null },
    raw: { fallback: true },
  };
}

/** ✅ Register evaluator with Genkit */
const ReadabilityDataPoint = z.object({
  input: z.unknown(),
  output: z.unknown().optional(),
  context: z.array(z.unknown()).optional(),
  reference: z.unknown().optional(),
  testCaseId: z.string().optional(),
  traceIds: z.array(z.string()).optional(),
});

/** Estimates readability scores using APYHub API or heuristic fallback. */
export const ReadabilityEvaluator = ai.defineEvaluator(
  {
    name: "readabilityEvaluator",
    displayName: "Readability Evaluator",
    definition: "Estimates text readability using APYHub or fallback heuristic.",
    dataPointType: ReadabilityDataPoint,
  },
  async (dataPoint) => {
    console.log('[ReadabilityEvaluator] Running with dataPoint text length:', (dataPoint.input as any)?.text?.length ?? 0);
    const input = ReadabilityInputSchema.parse(dataPoint.input);
    const result = await readabilityEvaluator(input);
    const { score, ...details } = result;

    const evaluationResult = {
      testCaseId: dataPoint.testCaseId!,
      evaluation: {
        score: score,
        details,
      },
    };
    console.log('[ReadabilityEvaluator] Final evaluation object:', JSON.stringify(evaluationResult, null, 2));
    return evaluationResult;
  }
);
