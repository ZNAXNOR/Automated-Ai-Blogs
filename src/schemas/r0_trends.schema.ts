import { z } from 'zod';
import { BlogTopic } from '../clients/blogTopic';

const blogTopic = z.enum(BlogTopic);

export const r0_trends_input = z.object({
  topic: blogTopic,
  timeframe: z.string().optional(),       // e.g. "now 7-d", "today 12-m"
  geo: z.string().optional(),              // e.g. "IN", "US"
  relatedLimit: z.number().optional(),     // how many related queries
});

export const r0_trends_output = z.object({
  baseTopic: z.string(),
  suggestions: z.array(
    z.object({
      topic: z.string(),
      score: z.number(),
    })
  ),
  trendTimeline: z.array(
    z.object({
      time: z.coerce.date(),
      value: z.number(),
    })
  ),
});
