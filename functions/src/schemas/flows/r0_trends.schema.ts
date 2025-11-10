import { z } from 'zod';

export const r0_trends_input = z.object({
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

export const r0_trends_output = z.object({
  baseTopic: z.string().optional(),          // if single topic
  aggregatedTopics: z.array(z.string()).optional(), // list of all processed topics
  suggestions: z.array(trendSuggestion),     // flattened + normalized aggregate
  trendTimeline: z.array(trendTimelinePoint),// merged average timeline (optional)
  results: z.array(                          // per-topic grouped output
    z.object({
      topic: z.string(),
      suggestions: z.array(trendSuggestion),
      trendTimeline: z.array(trendTimelinePoint),
    })
  ).optional(),
});
