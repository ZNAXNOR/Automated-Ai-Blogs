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
import { env } from "../utils/config"; // expects SERP_API_KEY, HF_TOKEN, USE_R0_LLM, CACHE_TTL_HOURS
import { getSerpSuggestions, getSerpRelated, getSerpTrending, serpAvailable } from "../clients/serp";
import { getCache, setCache } from "../utils/cache";
import * as crypto from "crypto";

// --- Types -------------------------------------------------------------------

export interface TrendItem {
  query: string; // normalized short query
  type: "autocomplete" | "related" | "trending" | "rss";
  score: number; // 0..1
  source: string[]; // e.g., ["serp:autocomplete","rss:theverge"]
  reason?: string; // <= 12 words
}

interface Round0Input {
  runId: string;
  seeds: string[];
  region?: string;
  useLLM?: boolean;
  force?: boolean;
}

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

// --- Lightweight RSS sources (fallback) --------------------------------------
// You can safely modify/extend this list.
const RSS_SOURCES: { name: string; url: string }[] = [
  { name: "rss:theverge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "rss:techcrunch", url: "https://techcrunch.com/feed/" },
  { name: "rss:bbcworld", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "rss:reutersworld", url: "https://feeds.reuters.com/reuters/worldNews" },
];

// --- Utilities ---------------------------------------------------------------

const ROUND = 0;

function logStep(runId: string, step: string, startMs: number) {
  const durationMs = Date.now() - startMs;
  // Use console.log for structured logs in emulator & prod
  console.log(JSON.stringify({ runId, round: ROUND, step, durationMs }));
}

function assertInput(i: any): asserts i is Round0Input {
  if (!i || typeof i !== "object") throw new HttpsError("invalid-argument", "Input must be an object");
  if (!i.runId || typeof i.runId !== "string") throw new HttpsError("invalid-argument", "runId is required");
  if (!Array.isArray(i.seeds) || i.seeds.some((s: string) => typeof s !== "string")) {
    throw new HttpsError("invalid-argument", "seeds must be a string[]");
  }
  if (i.region && typeof i.region !== "string") {
    throw new HttpsError("invalid-argument", "region must be a string");
  }
  if (i.useLLM !== undefined && typeof i.useLLM !== "boolean") {
    throw new HttpsError("invalid-argument", "useLLM must be boolean");
  }
}

function sha256(str: string) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

// Keep '+', '#', and '-'; strip other punctuation.
function stripPunctKeepSymbols(s: string): string {
  return s.replace(/[!"$%&'()*.,\/:;<=>?@\[\\\]^_`{|}~]/g, " "); // keep +, #, and -
}

// Normalize: lowercase, trim, collapse spaces, truncate to 6 words
export function normalizeQuery(raw: string): string {
  const s = stripPunctKeepSymbols(raw.toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter(Boolean).slice(0, 6);
  return words.join(" ");
}

// Filters per spec
export function shouldDrop(q: string): boolean {
  const tokens = q.split(" ").filter(Boolean);
  const hasPersonal = /\b(my|me|account|password)\b/.test(q);
  if (hasPersonal) return true;

  const numericCount = tokens.filter(t => /^\d+([\/\.\-]\d+)*$/.test(t)).length;
  if (tokens.length > 0 && numericCount / tokens.length > 0.6) return true;

  const generic = ["news", "update", "latest"];
  const containsGeneric = tokens.some(t => generic.includes(t));
  if (containsGeneric) {
    // allow if paired with context like "apple latest" (≥ 2 tokens and not only generic)
    if (tokens.length === 1 && generic.includes(tokens[0])) return true;
    const nonGenericCount = tokens.filter(t => !generic.includes(t)).length;
    if (nonGenericCount === 0) return true;
  }
  return false;
}

// Simple Levenshtein (enough for small N)
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

// Optionally call a tiny HF LLM to prune/score (kept very cheap)
// If env.HF_TOKEN missing or useLLM=false, skip and return passthrough.
async function optionalLlmPrune(
  items: TrendItem[],
  useLLM: boolean | undefined
): Promise<TrendItem[]> {
  if (!useLLM && !env.useR0Llm) return items;
  if (!env.HF_TOKEN) return items;

  // Token-efficient prompt: rank by general audience interest + freshness proxies
  const prompt =
`You are scoring short search queries for blog topics.
Keep 12 or fewer. Prefer widely interesting, multi-source, and non-duplicative.
Return as CSV: query,boost where boost in [0..0.2].

Items:
${items.map(i => `- ${i.query} [${i.type}]`).join("\n")}
`;

  try {
    // Lazy import to avoid dependency if unused
    const { hfTinyComplete } = await import("../clients/hf");
    const csv = await hfTinyComplete(prompt); // returns small CSV string or empty
    if (!csv) return items;

    const boosts = new Map<string, number>();
    csv.split(/\r?\n/).forEach(line => {
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

    // Re-sort and clamp to 12
    boosted.sort((a, b) => (b.score - a.score) || (a.query.length - b.query.length));
    return boosted.slice(0, 12);
  } catch (e) {
    console.warn("LLM prune skipped due to error:", e);
    return items;
  }
}

// --- RSS fetch & parse (lightweight) ----------------------------------------
// Minimal parser: extract <title>...</title> from top items (ignores CDATA nuances gracefully)
async function fetchRssTitles(url: string, limit = 20): Promise<string[]> {
  const res = await fetch(url, { method: "GET", redirect: "follow" });
  const text = await res.text();
  const titles: string[] = [];
  const re = /<title>([\s\S]*?)<\/title>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]
      .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    // Skip the feed-level title (usually first one)
    if (raw && titles.length < limit) titles.push(raw);
  }
  // Remove the first title if it is the channel title (heuristic)
  return titles.length > 1 ? titles.slice(1) : titles;
}

// --- Core deterministic pipeline --------------------------------------------

export function deterministicProcess(
  buckets: SourceBucket[]
): { items: TrendItem[]; sourceCounts: Record<string, number> } {
  const collected = new Map<string, TrendItem>();

  for (const b of buckets) {
    for (const raw of b.items) {
      const q = normalizeQuery(raw);
      if (!q || shouldDrop(q)) continue;

      if (collected.has(q)) {
        // Merge source/type
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

  // Near-duplicate merge
  const merged: TrendItem[] = [];
  for (const item of Array.from(collected.values())) {
    const dupIdx = merged.findIndex(m => nearDuplicate(m.query, item.query));
    if (dupIdx === -1) {
      merged.push(item);
    } else {
      // merge sources and keep best type (prefer trending > related > autocomplete > rss)
      const target = merged[dupIdx];
      const src = new Set([...target.source, ...item.source]);
      target.source = [...src];
      const typeRank = (t: TrendItem["type"]) =>
        t === "trending" ? 3 : t === "related" ? 2 : t === "autocomplete" ? 1 : 0;
      if (typeRank(item.type) > typeRank(target.type)) target.type = item.type;
    }
  }

  // Scoring
  const fromTrending = new Set(
    merged.filter(i => i.source.some(s => s.startsWith("serp:trending"))).map(i => i.query)
  );

  const itemsScored = merged.map(i => {
    let score = 0.5; // base
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

  // Sort by score desc then by query length asc; clamp 12
  itemsScored.sort((a, b) => (b.score - a.score) || (a.query.length - b.query.length));
  const final = itemsScored.slice(0, 12);

  // sourceCounts
  const sourceCounts: Record<string, number> = {};
  for (const i of final) {
    for (const s of i.source) sourceCounts[s] = (sourceCounts[s] ?? 0) + 1;
  }

  return { items: final, sourceCounts };
}

// --- Firestore artifact helpers ---------------------------------------------

async function getExistingArtifact(runId: string) {
  const ref = db.doc(`runs/${runId}`);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : undefined;
  const art = data?.artifacts?.round0;
  return art ? { ...art } : null;
}

async function writeArtifact(runId: string, payload: any) {
  const ref = db.doc(`runs/${runId}`);
  await ref.set(
    {
      artifacts: {
        round0: {
          ...payload,
          createdAt: FieldValue.serverTimestamp(),
        },
      },
    },
    { merge: true }
  );
}

// --- Main callable -----------------------------------------------------------

export const round0_trends = onCall(
  { timeoutSeconds: 300, memory: "256MiB" },
  async (req) => {
    const t0 = Date.now();
    const input = req.data;
    assertInput(input);
    const { runId, seeds, region, useLLM, force } = input;

    // Idempotency
    if (!force) {
      const existing = await getExistingArtifact(runId);
      if (existing) {
        logStep(runId, "idempotent-return", t0);
        return existing;
      }
    }

    const tSerp = Date.now();

    // --- Gather sources (Serp + RSS fallback) --------------------------------
    const buckets: SourceBucket[] = [];

    // SerpApi (if available)
    let usedSerp = false;
    let serpCacheHit = false;

    if (serpAvailable()) {
      usedSerp = true;
      const dayBucket = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for cache key
      const baseKey = JSON.stringify({ seeds, region, day: dayBucket });

      // Autocomplete
      {
        const cacheKey = `serpapi:${sha256(baseKey + ":autocomplete")}`;
        const cached = await getCache(cacheKey);
        let list: string[];
        if (cached?.payload) {
          list = cached.payload;
          serpCacheHit = true;
        } else {
          list = await getSerpSuggestions(seeds, region);
          await setCache(cacheKey, list, env.CACHE_TTL_HOURS);
        }
        buckets.push({ type: "autocomplete", sourceName: "serp:autocomplete", items: list });
      }
      // Related
      {
        const cacheKey = `serpapi:${sha256(baseKey + ":related")}`;
        const cached = await getCache(cacheKey);
        let list: string[];
        if (cached?.payload) {
          list = cached.payload;
          serpCacheHit = true;
        } else {
          list = await getSerpRelated(seeds, region);
          await setCache(cacheKey, list, env.CACHE_TTL_HOURS);
        }
        buckets.push({ type: "related", sourceName: "serp:related", items: list });
      }
      // Trending
      {
        const cacheKey = `serpapi:${sha256(baseKey + ":trending")}`;
        const cached = await getCache(cacheKey);
        let list: string[];
        if (cached?.payload) {
          list = cached.payload;
          serpCacheHit = true;
        } else {
          list = await getSerpTrending(region);
          await setCache(cacheKey, list, env.CACHE_TTL_HOURS);
        }
        buckets.push({ type: "trending", sourceName: "serp:trending", items: list });
      }
    }

    // RSS fallback (always included, but especially useful if Serp is unavailable)
    const tRss = Date.now();
    for (const src of RSS_SOURCES) {
      try {
        const titles = await fetchRssTitles(src.url, 20);
        buckets.push({ type: "rss", sourceName: src.name, items: titles });
      } catch (e) {
        console.warn(`RSS fetch error for ${src.name}`, e);
      }
    }
    logStep(runId, "fetch-sources", tSerp);

    // --- Deterministic normalization/dedup/score ------------------------------
    const tDet = Date.now();
    const { items: detItems, sourceCounts } = deterministicProcess(buckets);
    logStep(runId, "deterministic", tDet);

    // --- Optional LLM prune/boost --------------------------------------------
    const tLlm = Date.now();
    const finalItems = await optionalLlmPrune(detItems, useLLM);
    logStep(runId, "optional-llm", tLlm);

    // --- Output validation (simple) ------------------------------------------
    for (const i of finalItems) {
      if (!i.query || typeof i.query !== "string") throw new HttpsError("internal", "Invalid item.query");
      if (!["autocomplete", "related", "trending", "rss"].includes(i.type)) {
        throw new HttpsError("internal", "Invalid item.type");
      }
      if (typeof i.score !== "number" || i.score < 0 || i.score > 1) {
        throw new HttpsError("internal", "Invalid item.score");
      }
      if (!Array.isArray(i.source)) throw new HttpsError("internal", "Invalid item.source");
      if (i.reason && i.reason.split(/\s+/).length > 12) {
        throw new HttpsError("internal", "Invalid item.reason length");
      }
    }

    // --- Write artifact -------------------------------------------------------
    const artifact = {
      items: finalItems,
      cached: serpCacheHit,
      sourceCounts,
    };
    await writeArtifact(runId, artifact);

    logStep(runId, "done", t0);
    return artifact;
  }
);

// Export internals for unit testing
export const _test = {
  normalizeQuery,
  shouldDrop,
  deterministicProcess,
  nearDuplicate,
};
