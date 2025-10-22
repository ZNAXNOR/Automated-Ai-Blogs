/**
 * @file Humanization Evaluator
 * Performs heuristic + optional LLM-based analysis for "human-likeness" of text.
 */

import { z } from "zod";
import { ai } from "../clients/genkitInstance.client";
import {
  HumanizationInput,
  HumanizationResult,
  HumanizationInputSchema,  
  LLMGenerateHook,
} from "../schemas/evaluators/humanization.schema";

/** Internal helper: find repetitive n-grams. */
function getNgramRepetitions(words: string[], nMin = 3, nMax = 4, threshold = 3) {
  const counts: Record<string, number> = {};
  for (let n = nMin; n <= nMax; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const gram = words.slice(i, i + n).join(" ");
      counts[gram] = (counts[gram] || 0) + 1;
    }
  }
  return Object.entries(counts).filter(([, c]) => c >= threshold);
}

/** Core evaluation logic (pure function) */
export async function evaluateHumanization(
  input: HumanizationInput,
  opts?: { llmGenerate?: LLMGenerateHook }
): Promise<HumanizationResult> {
  console.log('[evaluateHumanization] Starting evaluation with input:', JSON.stringify(input, null, 2));
  const text = (input?.text ?? "").trim();

  if (!text) {
    console.log('[evaluateHumanization] Empty text provided. Returning score 0.');
    return {
      score: 0,
      detectedPatterns: ["empty_text"],
      recommendations: ["Provide content to evaluate."],
      raw: null,
    };
  }

  const patterns: string[] = [];
  const recommendations: string[] = [];

  // Sentence variance
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const sentenceLens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const avg = sentenceLens.length ? sentenceLens.reduce((a, b) => a + b, 0) / sentenceLens.length : 0;
  const variance = sentenceLens.length
    ? sentenceLens.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / sentenceLens.length
    : 0;
  console.log(`[evaluateHumanization] Sentence stats: count=${sentences.length}, avgLen=${avg.toFixed(2)}, variance=${variance.toFixed(2)}`);

  if (variance < 4) {
    patterns.push("low_sentence_length_variance");
    recommendations.push("Introduce sentence length variation to improve natural rhythm.");
  }

  // Contractions
  const contractionRegex = /\b(can't|won't|don't|it's|we're|you're|they're|isn't|aren't|wouldn't|shouldn't|couldn't|i'm|i've|we've|we'll)\b/i;
  if (!contractionRegex.test(text)) {
    patterns.push("no_contractions_detected");
    recommendations.push("Use contractions where appropriate to sound conversational.");
  }

  // Connector overuse
  const connectors = ["moreover", "furthermore", "additionally", "however", "therefore", "thus", "consequently"];
  const connectorsFound = connectors.filter((c) => new RegExp(`\\b${c}\\b`, "i").test(text));
  if (connectorsFound.length > 3) {
    patterns.push("overuse_of_connectors");
    recommendations.push("Reduce repetitive use of formal connectors.");
  }

  // Style variety
  const hasQuestions = /\?/.test(text);
  const hasExclamations = /!/.test(text);
  const parentheticals = /\([^)]{3,}\)/.test(text);
  if (!hasQuestions && !hasExclamations && !parentheticals) {
    patterns.push("flat_style");
    recommendations.push("Add rhetorical questions or parenthetical asides to vary tone.");
  }

  // Repetitions
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s']/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  const repeated = getNgramRepetitions(words);
  if (repeated.length > 0) {
    patterns.push("repetitive_phrases");
    recommendations.push("Avoid repeating long phrases verbatim.");
  }

  // Emotion cues
  const emotionCues = /\b(I think|I feel|in my opinion|excited|surprised|disappointed|love|hate|amazed)\b/i;
  const hasEmotion = emotionCues.test(text);

  console.log(`[evaluateHumanization] Detected heuristic patterns: ${patterns.join(', ') || 'None'}`);

  // Heuristic scoring
  let score = 80;
  if (patterns.includes("low_sentence_length_variance")) score -= 10;
  if (patterns.includes("no_contractions_detected")) score -= 8;
  if (patterns.includes("overuse_of_connectors")) score -= 12;
  if (patterns.includes("flat_style")) score -= 8;
  if (patterns.includes("repetitive_phrases")) score -= 15;
  if (hasEmotion) score += 6;
  if (hasQuestions || hasExclamations || parentheticals) score += 4;

  score = Math.max(0, Math.min(100, Math.round(score)));
  console.log(`[evaluateHumanization] Heuristic score calculated: ${score}`);

  // Optional LLM refinement
  let llmRaw: any = null;
  if (opts?.llmGenerate) {
    console.log('[evaluateHumanization] LLM refinement hook provided. Invoking...');
    try {
      const system = "You are a senior editor rating text for 'human-likeness' (0–100) and explaining briefly.";
      const prompt = `Rate the following text for human-likeness (0–100) and return JSON: {"score": <num>, "reasoning": "<brief>"}\n\nText:\n${text.slice(
        0,
        4000
      )}`;
      llmRaw = await opts.llmGenerate(system, prompt);
      console.log('[evaluateHumanization] LLM raw response:', JSON.stringify(llmRaw, null, 2));
      const candidate =
        (llmRaw && (typeof llmRaw.score === "number" ? llmRaw.score : Number(llmRaw?.data?.score ?? NaN))) ?? NaN;
      if (!Number.isNaN(candidate)) {
        const llmScore = Math.round(Math.max(0, Math.min(100, candidate)));
        score = Math.round((score + llmScore) / 2);
        recommendations.push("LLM-based refinement applied.");
        console.log(`[evaluateHumanization] LLM score ${llmScore} applied. Final score: ${score}`);
      }
    } catch (e) {
      console.error('[evaluateHumanization] LLM refinement failed:', e);
    }
  }

  const result: HumanizationResult = {
    score: score,
    detectedPatterns: patterns,
    recommendations: Array.from(new Set(recommendations)),
    raw: { heuristics: { avgSentenceLen: avg, variance, repeatedCount: repeated.length }, llm: llmRaw },
  };

  console.log('[evaluateHumanization] Final result:', JSON.stringify(result, null, 2));
  return result;
}

/** Zod schema for Genkit DataPoint */
const HumanizationDataPoint = z.object({
  input: z.unknown(),
  output: z.unknown().optional(),
  context: z.array(z.unknown()).optional(),
  reference: z.unknown().optional(),
  testCaseId: z.string().optional(),
  traceIds: z.array(z.string()).optional(),
});

/** Performs heuristic + optional LLM-based analysis for "human-likeness" of text. */
export const HumanizationEvaluator = ai.defineEvaluator(
  {
    name: "humanizationEvaluator",
    displayName: "Humanization Evaluator",
    definition:
      "Estimates how human-like the writing sounds using heuristic signals and optional LLM verification.",
    dataPointType: HumanizationDataPoint,
  },
  async (dataPoint) => {
    console.log('[HumanizationEvaluator] Running with dataPoint:', JSON.stringify(dataPoint, null, 2));
    const input = HumanizationInputSchema.parse(dataPoint.input);

    const llmGenerate: LLMGenerateHook = async (system, prompt) => {
      console.log('[HumanizationEvaluator] Calling Gemini for LLM evaluation...');
      const response = await ai.generate({
        model: "gemini-1.5-flash",
        prompt: `${system}\n\n${prompt}`,
        output: { format: "json" },
      });
      const output = response.output();
      console.log('[HumanizationEvaluator] Gemini response:', JSON.stringify(output, null, 2));
      return output;
    };

    const result = await evaluateHumanization(input, { llmGenerate });
    const { score, ...details } = result;

    const evaluationResult = {
      testCaseId: dataPoint.testCaseId!,
      evaluation: {
        score: score,
        details,
      },
    };
    console.log('[HumanizationEvaluator] Final evaluation object:', JSON.stringify(evaluationResult, null, 2));
    return evaluationResult;
  }
);
