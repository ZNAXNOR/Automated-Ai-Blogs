import { z } from 'zod';

// Round 0: Trends
export const TrendItemSchema = z.object({
  query: z.string(),
  type: z.enum(['autocomplete', 'related', 'trending', 'rss']),
  score: z.number(),
  source: z.array(z.string()),
  reason: z.string().optional(),
});

export const Round0InputSchema = z.object({
  runId: z.string(),
  seeds: z.array(z.string()),
  region: z.string().optional(),
  useLLM: z.boolean().optional(),
  force: z.boolean().optional(),
});

export const Round0OutputSchema = z.object({
  items: z.array(TrendItemSchema),
  cached: z.boolean(),
  sourceCounts: z.record(z.number()),
});

// Round 1: Ideate
export const IdeationItemSchema = z.object({
  trend: z.string(),
  idea: z.string(),
  variant: z.number(),
  source: z.literal('llm'),
});

export const Round1InputSchema = Round0OutputSchema;
export const Round1OutputSchema = z.object({
    items: z.array(IdeationItemSchema)
});

// Round 2: Outline
export const OutlineItemSchema = z.object({
    idea: z.string(),
    outline: z.array(z.string()),
});
export const Round2InputSchema = Round1OutputSchema;
export const Round2OutputSchema = z.object({
    items: z.array(OutlineItemSchema)
});

// Round 3: Draft
export const DraftItemSchema = z.object({
    idea: z.string(),
    draft: z.string(),
});
export const Round3InputSchema = Round2OutputSchema;
export const Round3OutputSchema = z.object({
    items: z.array(DraftItemSchema)
});

// Round 4: Polish
export const PolishedDraftItemSchema = z.object({
    idea: z.string(),
    polishedDraft: z.string(),
});
export const Round4InputSchema = Round3OutputSchema;
export const Round4OutputSchema = z.object({
    items: z.array(PolishedDraftItemSchema)
});

// Round 5: Meta
export const MetaItemSchema = z.object({
    idea: z.string(),
    meta: z.object({
        title: z.string(),
        description: z.string(),
        keywords: z.array(z.string()),
    }),
});
export const Round5InputSchema = Round4OutputSchema;
export const Round5OutputSchema = z.object({
    items: z.array(MetaItemSchema)
});


// Round 6: Coherence
export const CoherenceItemSchema = z.object({
    idea: z.string(),
    coherenceScore: z.number(),
});
export const Round6InputSchema = Round5OutputSchema;
export const Round6OutputSchema = z.object({
    items: z.array(CoherenceItemSchema)
});

// Round 7: Publish
export const PublishItemSchema = z.object({
    idea: z.string(),
    url: z.string(),
});
export const Round7InputSchema = Round6OutputSchema;
export const Round7OutputSchema = z.object({
    items: z.array(PublishItemSchema)
});

export type TrendItem = z.infer<typeof TrendItemSchema>;
export type Round0Input = z.infer<typeof Round0InputSchema>;
export type Round0Output = z.infer<typeof Round0OutputSchema>;
export type IdeationItem = z.infer<typeof IdeationItemSchema>;
export type Round1Input = z.infer<typeof Round1InputSchema>;
export type Round1Output = z.infer<typeof Round1OutputSchema>;
export type OutlineItem = z.infer<typeof OutlineItemSchema>;
export type Round2Input = z.infer<typeof Round2InputSchema>;
export type Round2Output = z.infer<typeof Round2OutputSchema>;
export type DraftItem = z.infer<typeof DraftItemSchema>;
export type Round3Input = z.infer<typeof Round3InputSchema>;
export type Round3Output = z.infer<typeof Round3OutputSchema>;
export type PolishedDraftItem = z.infer<typeof PolishedDraftItemSchema>;
export type Round4Input = z.infer<typeof Round4InputSchema>;
export type Round4Output = z.infer<typeof Round4OutputSchema>;
export type MetaItem = z.infer<typeof MetaItemSchema>;
export type Round5Input = z.infer<typeof Round5InputSchema>;
export type Round5Output = z.infer<typeof Round5OutputSchema>;
export type CoherenceItem = z.infer<typeof CoherenceItemSchema>;
export type Round6Input = z.infer<typeof Round6InputSchema>;
export type Round6Output = z.infer<typeof Round6OutputSchema>;
export type PublishItem = z.infer<typeof PublishItemSchema>;
export type Round7Input = z.infer<typeof Round7InputSchema>;
export type Round7Output = z.infer<typeof Round7OutputSchema>;