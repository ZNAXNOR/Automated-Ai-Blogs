import admin from 'firebase-admin';
import fetch from 'node-fetch';
import { z } from 'zod';
import { env } from '../utils/config';
import { logger } from '../utils/logger';
import { ResponseWrapper } from '../utils/responseHelper';
import { ARTIFACT_PATHS } from '../utils/constants';
import {
  Round1InputSchema,
  Round1OutputSchema,
} from '../utils/schema';

export type IdeationItem = z.infer<typeof Round1OutputSchema>["items"][number];

const MAX_IDEAS_PER_TREND = 5;
const MIN_IDEAS_PER_TREND = 3;
const MAX_TOTAL_IDEAS = 60;

if (!admin.apps.length) {
  admin.initializeApp();
}

// Schema for the raw output from the LLM
const LlmResponseSchema = z.array(
  z.object({
    trend: z.string(),
    ideas: z.array(z.string()),
  })
);

function buildPrompt(trendQueries: string[]): string {
  const prompt = `You are an expert blog strategist helping select article titles from trending topics.

TASK:
- For each input trend, generate 3–5 unique, creative blog title ideas.
- Titles should be short (≤12 words), clear, and engaging.
- Focus on human readability and search-friendliness.
- Avoid clickbait and repetition.

OUTPUT FORMAT (strict JSON only):
[
  {
    "trend": "<trend string>",
    "ideas": ["<title1>", "<title2>", "<title3>"]
  },
  ...
]

EXAMPLE:
Input: ["AI in healthcare"]
Output:
[
  {
    "trend": "AI in healthcare",
    "ideas": [
      "How AI is Transforming Healthcare in 2025",
      "AI in Hospitals: Benefits and Challenges",
      "The Future of Medicine with Artificial Intelligence"
    ]
  }
]

Input: ${JSON.stringify(trendQueries)}
`;
  return prompt;
}

async function callHuggingFace(prompt: string): Promise<ResponseWrapper> {
  const hfToken = env.hfToken;
  const HF_MODEL = env.hfModelR1;

  if (!hfToken) {
    throw new Error('HF_TOKEN environment variable is not set.');
  }
  if (!HF_MODEL || HF_MODEL.includes('<set-your-model')) {
    throw new Error(
      'HUGGINGFACE_MODEL environment variable is not set to a valid model slug.'
    );
  }

  const HF_ENDPOINT = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

  const payload = {
    inputs: prompt,
    parameters: {
      max_new_tokens: 512,
      return_full_text: true,
    },
  };

  const res = await fetch(HF_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('Hugging Face API error', { status: res.status, text });
    throw new Error(`Hugging Face API error: ${res.status} ${res.statusText} - ${text}`);
  }

  return ResponseWrapper.create(res);
}

function mapToIdeationItems(parsed: z.infer<typeof LlmResponseSchema>): IdeationItem[] {
  const items: IdeationItem[] = [];
  for (const entry of parsed) {
    const trend = String(entry.trend ?? '').trim();
    const ideas = Array.isArray(entry.ideas) ? entry.ideas : [];

    if (!trend) continue;
    const cleanedIdeas = ideas
      .map((s: any) => String(s ?? '').trim())
      .filter((s: string) => s.length > 0)
      .slice(0, MAX_IDEAS_PER_TREND);

    if (cleanedIdeas.length < MIN_IDEAS_PER_TREND) {
      continue;
    }

    cleanedIdeas.forEach((idea: string, idx: number) => {
      items.push({
        trend,
        idea,
        variant: idx + 1,
        source: 'llm',
      });
    });
  }

  if (items.length > MAX_TOTAL_IDEAS) {
    items.splice(MAX_TOTAL_IDEAS);
  }

  return items.filter((it) => it.idea.trim().length > 0);
}

export async function Round1_Ideate(runId: string): Promise<{ wrote: number }> {
  logger.info('Round 1: Ideate starting', { runId });
  if (!runId) throw new Error('runId is required');

  const db = admin.firestore();

  const r0DocRef = db.collection('runs').doc(runId).collection('artifacts').doc('round0');
  const r0Snap = await r0DocRef.get();
  if (!r0Snap.exists) {
    logger.error('Round0 artifact not found', { runId });
    throw new Error(`Round0 artifact not found for runId=${runId} at runs/${runId}/artifacts/round0`);
  }

  const r0Data = r0Snap.data() || {};

  const validationResult = Round1InputSchema.safeParse(r0Data);
  if (!validationResult.success) {
    logger.error('Round 1 Input validation failed', {
      runId,
      error: validationResult.error,
    });
    throw new Error('Round 1 Input validation failed');
  }

  const { items: trendsFromDoc } = validationResult.data;

  if (!Array.isArray(trendsFromDoc) || trendsFromDoc.length === 0) {
    throw new Error(`No trends found in round0 artifact for runId=${runId}`);
  }

  const trendQueries = Array.from(
    new Set(trendsFromDoc.map((t) => String(t.query ?? '').trim()).filter((s) => s.length > 0))
  ).slice(0, 12);

  if (trendQueries.length === 0) {
    throw new Error('After normalization, no valid trend queries were found.');
  }

  const prompt = buildPrompt(trendQueries);

  const hfResponse = await callHuggingFace(prompt);
  const parsed = await hfResponse.json(LlmResponseSchema);

  const ideationItems = mapToIdeationItems(parsed);

  if (ideationItems.length === 0) {
    throw new Error('No valid ideation items produced by LLM.');
  }

  const trendsMap = new Map<string, number>();
  for (const it of ideationItems) {
    trendsMap.set(it.trend, (trendsMap.get(it.trend) || 0) + 1);
  }

  for (const t of trendQueries) {
    const count = trendsMap.get(t) || 0;
    if (count < MIN_IDEAS_PER_TREND) {
      throw new Error(`Trend \"${t}\" produced fewer than ${MIN_IDEAS_PER_TREND} ideas (${count}).`);
    }
  }

  const outputForValidation: z.infer<typeof Round1OutputSchema> = {
    items: ideationItems,
  };
  const outputValidationResult = Round1OutputSchema.safeParse(outputForValidation);

  if (!outputValidationResult.success) {
    logger.error('Round 1 Output validation failed', {
      runId,
      error: outputValidationResult.error,
    });
    throw new Error('Round 1 Output validation failed');
  }

  const r1ArtifactPath = ARTIFACT_PATHS.R1_IDEATION.replace('{runId}', runId);
  const r1DocRef = db.doc(r1ArtifactPath);

  await r1DocRef.set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...outputValidationResult.data,
  });

  logger.info('Round 1: Ideate finished', { runId, wrote: ideationItems.length });
  return { wrote: ideationItems.length };
}
