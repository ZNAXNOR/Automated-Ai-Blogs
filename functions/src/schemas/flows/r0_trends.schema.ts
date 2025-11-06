import {z} from "zod";

export const r0TrendsInput = z.object({
  topic: z.union([z.string(), z.array(z.string())]),
  geo: z.string().optional(),
  timeframe: z.string().optional(),
  category: z.number().optional(),
  relatedLimit: z.number().optional(),
});

export const trendSuggestion = z.object({
  topic: z.string(),
  score: z.number(),
});

export const trendTimelinePoint = z.object({
  time: z.date(),
  value: z.number(),
});

export const r0TrendsOutput = z.object({
  baseTopic: z.string().optional(),
  aggregatedTopics: z.array(z.string()).optional(),
  suggestions: z.array(trendSuggestion),
  trendTimeline: z.array(trendTimelinePoint),
  results: z.array(
    z.object({
      topic: z.string(),
      suggestions: z.array(trendSuggestion),
      trendTimeline: z.array(trendTimelinePoint),
    })
  ).optional(),
});
