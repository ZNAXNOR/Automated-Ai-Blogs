// src/rounds/r7_publish.ts
import { getFirestore } from "firebase-admin/firestore";
import { httpClient } from "../clients/http";


type Round6Doc = {
  trendId: string;
  validatedText: string;
  metadata: {
    title: string;
    description: string;
    tags: string[];
  };
};

type Round7Record = {
  trendId: string;
  wpPostId?: number;
  status: "draft" | "error";
  errorMessage?: string;
  publishedAt?: string;
};

const WP_SITE = process.env.WP_SITE;
const WP_USER = process.env.WP_USER;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

function buildAuthHeader() {
  const creds = `${WP_USER}:${WP_APP_PASSWORD}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

async function resolveExistingTagIds(tagNames: string[]): Promise<number[]> {
  if (!tagNames?.length) return [];
  const ids: number[] = [];
  for (const t of tagNames) {
    try {
      const resp = await httpClient.request({
        method: "GET",
        url: `https://${WP_SITE}/wp-json/wp/v2/tags?search=${encodeURIComponent(t)}&per_page=1`,
        headers: { Authorization: buildAuthHeader() },
      });
      const data = resp.data;
      if (Array.isArray(data) && data[0]?.id) ids.push(Number(data[0].id));
    } catch {
      // skip silently
    }
  }
  return ids;
}

async function publishToWP({
  title,
  content,
  excerpt,
  tags,
}: {
  title: string;
  content: string;
  excerpt: string;
  tags: number[];
}) {
  const resp = await httpClient.request({
    method: "POST",
    url: `https://${WP_SITE}/wp-json/wp/v2/posts`,
    headers: {
      Authorization: buildAuthHeader(),
      "Content-Type": "application/json",
    },
    data: {
      title,
      content,
      status: "draft",
      excerpt,
      ...(tags?.length ? { tags } : {}),
    },
  });
  const data = resp.data;
  if (!data?.id) throw new Error("WP response missing id");
  return Number(data.id);
}

export async function runRound7Publish() {
  const db = getFirestore();
  const r6 = await db.collection("round6_coherence").get();
  const r7 = db.collection("round7_publish");

  let processed = 0,
    skipped = 0,
    succeeded = 0,
    failed = 0;

  for (const doc of r6.docs) {
    const d = doc.data() as Round6Doc;
    processed++;

    const exists = await r7.where("trendId", "==", d.trendId).limit(1).get();
    if (!exists.empty) {
      skipped++;
      continue;
    }

    try {
      const tagIds = await resolveExistingTagIds(d.metadata.tags);
      const wpId = await publishToWP({
        title: d.metadata.title,
        content: d.validatedText,
        excerpt: d.metadata.description,
        tags: tagIds,
      });
      await r7.add({
        trendId: d.trendId,
        wpPostId: wpId,
        status: "draft",
        publishedAt: new Date().toISOString(),
      } as Round7Record);
      succeeded++;
    } catch (err: any) {
      await r7.add({
        trendId: d.trendId,
        status: "error",
        errorMessage: err.message ?? String(err),
      } as Round7Record);
      failed++;
    }
  }

  return { processed, skipped, succeeded, failed };
}
