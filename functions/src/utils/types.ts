// src/utils/types.ts
export type RoundName = "r0_trends" | "r1_ideate" | "r2_outline" | "r3_drafts" | "r4_polish" | "r5_meta" | "r6_coherence" | "r7_publish";

export interface JobPayload {
  trendInput?: any;
  topicIdeas?: any;
  outline?: any;
  draft?: any;
  polished?: any;
  meta?: any;
  qualityChecks?: any;
}

export interface JobState {
  payload: JobPayload;
  currentRound: number;  // 0 means start with R0
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
  wpPostUrl?: string;
}
