import { z } from "zod";

const minute = 60;
const hour = 60 * minute;

export const constants = {
    // --- Round 0 --- 
    TRENDS_PER_RUN: 25,
    TINY_HF_MODEL: "gpt2",

    // --- Round 3 ---
    MIN_DRAFT_WORD_COUNT: 250,
    MAX_DRAFT_WORD_COUNT: 400,

    // --- Round 4 ---
    MIN_POLISH_WORD_COUNT: 250,
    MAX_POLISH_WORD_COUNT: 500,
    MAX_REFINEMENT_ATTEMPTS: 2,

    // --- Round 5 ---
    MIN_META_WORD_COUNT: 100,

    // --- Round 7 ---
    DEFAULT_WP_TAGS: ["AI Content"],

    // --- Global ---
    MAX_RUN_DURATION_SECONDS: 20 * minute,
    MAX_RETRY_ATTEMPTS: 2,
    RUNS_COLLECTION: "runs",

    // --- Firestore Paths ---
    ARTIFACT_PATHS: {
        R0_TRENDS: 'runs/{runId}/artifacts/round0/data',
        R1_IDEAS: 'runs/{runId}/artifacts/round1/data',
        R2_OUTLINES: 'runs/{runId}/artifacts/round2/data',
        R3_DRAFTS: 'runs/{runId}/artifacts/round3/data',
        R4_POLISHED: 'runs/{runId}/artifacts/round4/data',
        R4_FAILURES: 'runs/{runId}/artifacts/round4-failures/data',
        R5_METADATA: 'runs/{runId}/artifacts/round5/data',
        R6_COHERENCE: 'runs/{runId}/artifacts/round6/data',
        R7_PUBLISHED: 'runs/{runId}/artifacts/round7/data',
    },

    // --- Caching ---
    CACHE_TTL: {
        DEFAULT: 1 * hour,
        SERP: 24 * hour,
        TRENDS: 24 * hour,
        IDEAS: 1 * hour,
        DRAFTS: 1 * hour,
        METADATA: 1 * hour,
        COHERENCE: 1 * hour,
    }

};

export const TrendItem = z.object({
    query: z.string(),
    type: z.enum(["trending", "related", "autocomplete", "rss"]),
    score: z.number(),
    source: z.array(z.string()),
});
