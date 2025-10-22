/**
 * @file evaluateAll Evaluator
 * Combines multiple evaluators into a unified evaluation.
 */

import { ai } from "../clients/genkitInstance.client";
import { z } from "zod";
import { EvaluateAllInput, EvaluateAllResult } from "../schemas/evaluators/evaluateAll.schema";
import { clamp } from "@utils/evaluator.util";

/** Zod DataPoint for Genkit */
const EvaluateAllDataPoint = z.object({
  input: z.unknown(),
  output: z.unknown().optional(),
  context: z.array(z.unknown()).optional(),
  reference: z.unknown().optional(),
  testCaseId: z.string().optional(),
  traceIds: z.array(z.string()).optional(),
});

/**
 * Aggregates multiple evaluator results into a single score.
 * Assumes each sub-evaluator result has a numeric `score` or similar metric.
 */
export const evaluateAllEvaluator = ai.defineEvaluator(
  {
    name: "evaluateAll",
    displayName: "Evaluate All",
    definition: "Aggregates Humanization, Metadata, Readability, and SEO evaluations into a unified assessment.",
    dataPointType: EvaluateAllDataPoint,
  },
  async (dataPoint) => {
    console.log('[evaluateAll]    Starting evaluation with dataPoint:', JSON.stringify(dataPoint, null, 2));
    const input: EvaluateAllInput = dataPoint.input as EvaluateAllInput;

    const humanizationScore = input.humanization?.humanizationScore ?? undefined;
    const metadataScore = input.metadata?.metadataScore ?? undefined;
    const readabilityScore = input.readability?.readabilityScore ?? undefined;
    const seoScore = input.seo?.seoScore ?? undefined;
    
    console.log(`[evaluateAll]    Extracted Scores: humanization=${humanizationScore}, metadata=${metadataScore}, readability=${readabilityScore}, seo=${seoScore}`);

    // Compute overall: average of available scores
    const availableScores = [humanizationScore, metadataScore, readabilityScore, seoScore].filter((s) => typeof s === "number");
    const overall = availableScores.length
      ? clamp(Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length))
      : 0;
      
    console.log(`[evaluateAll]    Calculated Overall Score: ${overall} from ${availableScores.length} scores.`);

    const result: EvaluateAllResult = {
      scores: {
        humanization: humanizationScore,
        metadata: metadataScore,
        readability: readabilityScore,
        seo: seoScore,
        overall,
      },
      details: {
        humanization: input.humanization,
        metadata: input.metadata,
        readability: input.readability,
        seo: input.seo,
      },
      raw: input,
    };

    console.log('[evaluateAll]    Final evaluation result:', JSON.stringify(result, null, 2));

    return {
      testCaseId: dataPoint.testCaseId,
      evaluation: result,
    };
  }
);
