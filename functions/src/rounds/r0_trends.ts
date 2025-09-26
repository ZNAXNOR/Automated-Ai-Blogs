/*
 * Deterministic, zero-cost by default. Optionally prunes/scores via a tiny HF model.
 *
 * Inputs:
 *   runId: string
 *   seeds: string[]
 *   region?: string
 *   useLLM?: boolean (default false)
 *
 * Side effects:
 *   - Writes artifact to Firestore: runs/{runId}.artifacts.round0
 *   - Caches SerpApi responses under cache/serpapi/{hash} with TTL
 *
 * Notes:
 *   - If SerpApi key not present, we fall back to RSS-only path.
 *   - The deterministic path is always executed; the LLM step is an optional extra prune.
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

import { env } from "../utils/config";
import { getSerpSuggestions, getSerpRelated, getSerpTrending, serpAvailable } from "../clients/serp";
import { getCache, setCache } from "../utils/cache";
import { Round0InputSchema, Round0OutputSchema } from "../utils/schema";
import type { TrendItem, Round0Input, JobPayload } from "../utils/types";
import { constants } from "../utils/constants";
import { logger } from "../utils/logger";
import { ResponseWrapper } from "../utils/responseHelper";
import fetch from "node-fetch";
import { hfComplete } from "../clients/hf";

// Re-export TrendItem for test file
export type { TrendItem } from '../utils/schema';

type SourceBucket = {
  type: TrendItem["type"];
  sourceName: string; // "serp:autocomplete" | "serp:related" | "serp:trending" | "rss:<domain>"
  items: string[]; // raw candidate strings (unnormalized)
};

// --- Admin init (safe if already initialized) --------------------------------
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// --- Lightweight RSS sources (fallback) --------------------------------------
const RSS_SOURCES: { name: string; url: string }[] = [
  { name: "rss:theverge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "rss:techcrunch", url: "https://techcrunch.com/feed/" },
  { name: "rss:bbcworld", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "rss:nytimes", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
];

// --- Utilities ---------------------------------------------------------------

const ROUND = 0;

function sha256(str: string) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function stripPunctKeepSymbols(s: string): string {
  return s.replace(/[!\"$%&'()*.,\/:;<=>?@\[\\\]^_`{|}~]/g, " ");
}

export function normalizeQuery(raw: string): string {
  const s = stripPunctKeepSymbols(raw.toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter(Boolean).slice(0, 4);
  return words.join(" ");
}

export function shouldDrop(q: string): boolean {
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length < 2) return true;

  const hasPersonal = /\b(my|me|account|password)\b/.test(q);
  if (hasPersonal) return true;

  const numericCount = tokens.filter(t => /^\d+([\/\.\-]\d+)*$/.test(t)).length;
  if (tokens.length > 0 && numericCount / tokens.length > 0.6) return true;

  const generic = ["news", "update", "latest"];
  const isGeneric = tokens.every(t => generic.includes(t));
  if (isGeneric) return true;

  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const v0 = Array(b.length + 1).fill(0);
  const v1 = Array(b.length + 1).fill(0);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function tokenOverlap(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  A.forEach(t => {
    if (B.has(t)) inter++;
  });
  const union = new Set([...A, ...B]).size;
  return inter / union;
}

function nearDuplicate(a: string, b: string): boolean {
  return levenshtein(a, b) <= 2 || tokenOverlap(a, b) >= 0.75;
}

async function optionalLlmPrune(
  items: TrendItem[],
  useLLM: boolean | undefined
): Promise<TrendItem[]> {
  if (!useLLM && !env.useR0Llm) return items;
  if (!env.hfToken) return items;

  const prompt =
`You are scoring short search queries for blog topics.
Keep 12 or fewer. Prefer widely interesting, multi-source, and non-duplicative.
Return as CSV: query,boost where boost in [0..0.2].

Items:
${items.map(i => `- ${i.query} [${i.type}]`).join("\n")}
`;

  try {
    const csv = await hfComplete(prompt, constants.TINY_HF_MODEL);
    if (!csv) return items;

    const boosts = new Map<string, number>();
    csv.split(/\r?\n/).forEach((line: string) => {
      const m = line.split(",");
      if (m.length >= 2) {
        const q = normalizeQuery(m[0] || "");
        const b = Number(m[1]);
        if (q && isFinite(b)) boosts.set(q, Math.max(0, Math.min(0.2, b)));
      }
    });

    const boosted = items.map(i => ({
      ...i,
      score: Math.max(0, Math.min(1, i.score + (boosts.get(i.query) ?? 0))),
    }));

    boosted.sort((a, b) => (b.score - a.score) || (a.query.length - b.query.length));
    return boosted.slice(0, 12);
  } catch (e) {
    logger.warn("LLM prune skipped due to error:", e);
    return items;
  }
}

async function fetchRssTitles(url: string, limit = 20): Promise<string[]> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const responseWrapper = ResponseWrapper.create(res as any);
    if (!res.ok) {
      logger.warn(`Failed to fetch RSS feed from ${url}, status: ${res.status}`);
      return [];
    }
    const text = await responseWrapper.text();
    const titles: string[] = [];
    const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const itemContent = match[1];
      const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/i;
      const titleMatch = itemContent.match(titleRegex);
      if (titleMatch && titleMatch[1]) {
        const raw = titleMatch[1]
          .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "\'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
        if (raw && titles.length < limit) {
          titles.push(raw);
        }
      }
    }
    logger.info(`Found ${titles.length} titles from ${url}`);
    return titles;
  } catch (error) {
    logger.warn(`Error fetching or parsing RSS feed from ${url}:`, error);
    return [];
  }
}

export function deterministicProcess(
  buckets: SourceBucket[]
): { items: TrendItem[]; sourceCounts: Record<string, number> } {
  const collected = new Map<string, TrendItem>();

  for (const b of buckets) {
    for (const raw of b.items) {
      const q = normalizeQuery(raw);
      if (!q || shouldDrop(q)) continue;

      if (collected.has(q)) {
        const existing = collected.get(q)!;
        const newSources = new Set([...existing.source, b.sourceName]);
        existing.source = [...newSources];
        const typeRank = (t: TrendItem["type"]) =>
          t === "trending" ? 3 : t === "related" ? 2 : t === "autocomplete" ? 1 : 0;
        if (typeRank(b.type) > typeRank(existing.type)) {
          existing.type = b.type;
        }
      } else {
        collected.set(q, {
          query: q,
          type: b.type,
          score: 0,
          source: [b.sourceName],
        });
      }
    }
  }

  const merged: TrendItem[] = [];
  for (const item of Array.from(collected.values())) {
    const dupIdx = merged.findIndex(m => nearDuplicate(m.query, item.query));
    if (dupIdx === -1) {
      merged.push(item);
    } else {
      const target = merged[dupIdx];
      const src = new Set([...target.source, ...item.source]);
      target.source = [...src];
      const typeRank = (t: TrendItem["type"]) =>
        t === "trending" ? 3 : t === "related" ? 2 : t === "autocomplete" ? 1 : 0;
      if (typeRank(item.type) > typeRank(target.type)) target.type = item.type;
    }
  }

  const fromTrending = new Set(
    merged.filter(i => i.source.some(s => s.startsWith("serp:trending"))).map(i => i.query)
  );

  const itemsScored = merged.map(i => {
    let score = 0.5;
    const multiSource = i.source.length > 1;
    if (multiSource) score += 0.10;
    if (fromTrending.has(i.query)) score += 0.10;
    score = Math.max(0, Math.min(1, score));
    const reasonBits = [];
    if (fromTrending.has(i.query)) reasonBits.push("trending");
    if (multiSource) reasonBits.push("multi-source");
    const reason = reasonBits.length ? reasonBits.join(", ").slice(0, 48) : undefined;
    return { ...i, score, reason };
  });

  itemsScored.sort((a, b) => (b.score - a.score) || (a.query.length - b.query.length));
  const final = itemsScored.slice(0, 12);

  const sourceCounts: Record<string, number> = {};
  for (const i of final) {
    for (const s of i.source) sourceCounts[s] = (sourceCounts[s] ?? 0) + 1;
  }

  return { items: final, sourceCounts };
}

async function getExistingArtifact(runId: string) {
  const ref = db.doc(constants.ARTIFACT_PATHS.R0_TRENDS.replace('{runId}', runId));
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

async function writeArtifact(runId:string, payload: any) {
    const parsed = Round0OutputSchema.safeParse(payload);
    if (!parsed.success) {
        logger.error(`Round 0 output validation failed for runId: ${runId}`, { error: parsed.error });
        throw new HttpsError("internal", "Round 0 output validation failed", { error: parsed.error });
    }
    const ref = db.doc(constants.ARTIFACT_PATHS.R0_TRENDS.replace('{runId}', runId));
    await ref.set({
        ...parsed.data,
        createdAt: FieldValue.serverTimestamp(),
    });
}

// Helper to fetch and cache a single SERP API call
async function getCachedSerp(key: string, fetcher: () => Promise<string[]>): Promise<{ list: string[], fromCache: boolean }> {
    const cacheKey = `serpapi:${sha256(key)}`;
    const cached = await getCache(cacheKey);
    if (cached?.payload) {
        return { list: cached.payload, fromCache: true };
    }
    const list = await fetcher();
    await setCache(cacheKey, list, env.CACHE_TTL_HOURS);
    return { list, fromCache: false };
}

export async function run(payload: JobPayload) {
    const t0 = Date.now();

    const validation = Round0InputSchema.safeParse(payload);
    if (!validation.success) {
        logger.error(`Round 0 input validation failed`, { error: validation.error });
        throw new HttpsError("invalid-argument", "Invalid input", { error: validation.error.format() });
    }
    const { runId, seeds, region, useLLM, force } = validation.data;
    logger.info(`Starting Round 0 for runId: ${runId}`, { runId });

    if (!force) {
      const existing = await getExistingArtifact(runId);
      if (existing) {
        logger.info(`Round 0 idempotent return for runId: ${runId}`, { runId });
        return existing;
      }
    }

    const tSerp = Date.now();
    const buckets: SourceBucket[] = [];
    let usedSerp = false;
    let anyCacheMiss = false;

    if (serpAvailable()) {
      usedSerp = true;
      const dayBucket = new Date().toISOString().slice(0, 10);
      const baseKey = JSON.stringify({ seeds, region, day: dayBucket });

      const [autocomplete, related, trending] = await Promise.all([
          getCachedSerp(baseKey + ":autocomplete", () => getSerpSuggestions(seeds, region)),
          getCachedSerp(baseKey + ":related", () => getSerpRelated(seeds, region)),
          getCachedSerp(baseKey + ":trending", () => getSerpTrending(region)),
      ]);

      buckets.push({ type: "autocomplete", sourceName: "serp:autocomplete", items: autocomplete.list });
      buckets.push({ type: "related", sourceName: "serp:related", items: related.list });
      buckets.push({ type: "trending", sourceName: "serp:trending", items: trending.list });

      if (!autocomplete.fromCache || !related.fromCache || !trending.fromCache) {
          anyCacheMiss = true;
      }
    }

    const tRss = Date.now();
    const rssResults = await Promise.allSettled(
        RSS_SOURCES.map(src => fetchRssTitles(src.url, 20).then(titles => ({ type: "rss" as const, sourceName: src.name, items: titles })))
    );

    rssResults.forEach(result => {
        if (result.status === 'fulfilled') {
            buckets.push(result.value);
        } else {
            logger.warn(`RSS fetch failed`, { error: result.reason });
        }
    });

    logger.info(`Fetched sources for runId: ${runId}`, { runId, round: ROUND, durationMs: Date.now() - tSerp });

    const tDet = Date.now();
    const { items: detItems, sourceCounts } = deterministicProcess(buckets);
    logger.info(`Deterministic processing complete for runId: ${runId}`, { runId, count: detItems.length, durationMs: Date.now() - tDet });

    const tLlm = Date.now();
    const finalItems = await optionalLlmPrune(detItems, useLLM);
    logger.info(`Optional LLM pruning complete for runId: ${runId}`, { runId, count: finalItems.length, durationMs: Date.now() - tLlm });

    const artifact = {
      items: finalItems,
      cached: usedSerp && !anyCacheMiss,
      sourceCounts,
    };

    await writeArtifact(runId, artifact);

    logger.info(`Finished Round 0 for runId: ${runId}`, { runId, durationMs: Date.now() - t0 });
    return artifact;
}

export const Round0_Trends = onCall(
  { timeoutSeconds: 300, memory: "256MiB", region: env.region },
  (req) => run(req.data)
);

export const _test = {
  normalizeQuery,
  shouldDrop,
  deterministicProcess,
  nearDuplicate,
};
