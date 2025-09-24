import { z } from 'zod';

export interface JobPayload {
    runId?: string;
    trendInput?: any;
    [key: string]: any;
}

export interface TrendItem {
  query: string;
  type: "autocomplete" | "related" | "trending" | "rss";
  score: number;
  source: string[];
}

export interface Round0Input {
  runId: string;
  seeds: string[];
  region?: string;
  useLLM?: boolean;
  force?: boolean;
}

export interface R1Ideation {
  trend: string;
  idea: string;
}

export interface R2Outline {
  trend: string;
  idea: string;
  sections: { heading: string; bullets: string[]; estWordCount: number }[];
  title: string;
  wordCount: number;
}

export interface R3Draft {
  trendId: string;
  title: string;
  draft: string;
}

export interface R4Polish {
  trendId: string;
  title: string;
  draft: string;
  wordCount: number;
}

export const R5Meta = z.object({
  trendId: z.string(),
  title: z.string(),
  draft: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
});

export type R5Meta = z.infer<typeof R5Meta>;

export const R6Coherence = R5Meta.extend({
  coherenceScores: z.object({
    overall: z.number(),
    sentence: z.array(z.number()),
  }),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  excerpt: z.string().optional(),
  relatedKeywords: z.array(z.any()).optional(),
  imageSuggestions: z.array(z.any()).optional(),
});

export type R6Coherence = z.infer<typeof R6Coherence>;
