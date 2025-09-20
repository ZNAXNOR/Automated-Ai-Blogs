// src/rounds/r7_publish.ts
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { httpClient } from "../clients/http";
import { env } from "../utils/config";

type Round6Doc = {
  trendId: string;
  validatedText: string;
  metadata: {
    title: string;
    description: string;
    tags: string[];
    version?: number;
  };
};

type Round7Record = {
  trendId: string;
  wpPostId?: number;
  status: "draft" | "error" | "skipped";
  errorMessage?: string;
  publishedAt?: string;
  createdAt: Timestamp;
};

const { wpApiUrl, wpUsername, wpPassword } = env;

function buildAuthHeader() {
  const creds = `${wpUsername}:${wpPassword}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

async function resolveExistingTagIds(tagNames: string[]): Promise<number[]> {
  if (!tagNames?.length) return [];
  const ids: number[] = [];
  const tagPromises = tagNames.map(async (t) => {
    try {
      const resp = await httpClient.request({
        method: "GET",
        url: `${wpApiUrl}/tags?search=${encodeURIComponent(t)}&per_page=1`,
        headers: { Authorization: buildAuthHeader() },
      });
      const data = resp.data;
      if (Array.isArray(data) && data[0]?.id) return Number(data[0].id);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to resolve tag ID for "${t}":`, errorMessage);
    }
    return null;
  });

  const results = await Promise.all(tagPromises);
  return results.filter((id): id is number => id !== null);
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
}): Promise<number> {
  const resp = await httpClient.request({
    method: "POST",
    url: `${wpApiUrl}/posts`,
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
  if (resp.status !== 201 || !resp.data?.id) {
    throw new Error(
      `Failed to create post in WordPress. Status: ${resp.status}, Body: ${JSON.stringify(resp.data)}`
    );
  }
  return Number(resp.data.id);
}

export async function Round7_Publish(runId: string) {
  if (!runId) throw new Error("runId is required");

  const db = getFirestore();
  const r6Collection = db.collection(`runs/${runId}/artifacts/round6`);
  const r7Collection = db.collection(`runs/${runId}/artifacts/round7`);

  const existingR7Docs = await r7Collection.get();
  const publishedTrendIds = new Set(existingR7Docs.docs.map((d) => d.data().trendId));

  const r6Docs = await r6Collection.get();

  let processed = 0,
    skipped = 0,
    succeeded = 0,
    failed = 0;

  const batch = db.batch();

  const publishPromises = r6Docs.docs.map(async (doc) => {
    processed++;
    const d = doc.data() as Round6Doc;

    if (publishedTrendIds.has(d.trendId)) {
      skipped++;
      return;
    }

    if (!d.metadata?.title || !d.validatedText) {
        failed++;
        const newR7Ref = r7Collection.doc();
        batch.set(newR7Ref, {
            trendId: d.trendId,
            status: 'error',
            errorMessage: 'Missing title or content',
            createdAt: Timestamp.now(),
        });
        return;
    }

    try {
      const tagIds = await resolveExistingTagIds(d.metadata.tags);
      const wpId = await publishToWP({
        title: d.metadata.title,
        content: d.validatedText,
        excerpt: d.metadata.description,
        tags: tagIds,
      });

      const newR7Ref = r7Collection.doc();
      batch.set(newR7Ref, {
        trendId: d.trendId,
        status: "draft",
        wpPostId: wpId,
        publishedAt: Timestamp.now().toDate().toISOString(),
        createdAt: Timestamp.now(),
      });

      succeeded++;
    } catch (err: unknown) {
      failed++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Failed to publish trendId ${d.trendId}:`, errorMessage);

      const newR7Ref = r7Collection.doc();
      batch.set(newR7Ref, {
          trendId: d.trendId,
          status: 'error',
          errorMessage,
          createdAt: Timestamp.now(),
      });
    }
  });

  await Promise.allSettled(publishPromises);

  await batch.commit();

  return { processed, skipped, succeeded, failed };
}
