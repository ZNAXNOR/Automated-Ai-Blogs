// r8_publish.flow.ts
import { ai } from "../clients/genkitInstance.client"; // adjust path to your genkit client
import { r8_publish_input, r8_publish_output, R8PublishInput } from "../schemas/flows/r8_publish.schema";
import wordpressClient from "../clients/wordpress.client";
import { persistRoundOutput } from '../adapters/roundStorage.adapter';

let marked: any = null;
/**
 * Try to import 'marked' for robust Markdown -> HTML conversion.
 * If not available, flow falls back to a simple converter.
 */
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  marked = require("marked");
} catch {
  marked = null;
}

/**
 * naiveMarkdownToHtml - fallback converter if 'marked' isn't installed.
 * Keeps paragraphs intact and converts headings (#..).
 * This is intentionally minimal — install 'marked' for better conversions.
 */
function naiveMarkdownToHtml(md: string) {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let buffer: string[] = [];

  function flushBuffer() {
    if (buffer.length === 0) return;
    const joined = buffer.join(" ").trim();
    if (joined) out.push(`<p>${escapeHtml(joined)}</p>`);
    buffer = [];
  }

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushBuffer();
      continue;
    }
    // headings
    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      flushBuffer();
      const level = Math.min(hMatch[1].length, 6);
      out.push(`<h${level}>${escapeHtml(hMatch[2])}</h${level}>`);
      continue;
    }
    buffer.push(line);
  }
  flushBuffer();
  return out.join("\n");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * buildPostPayload - maps input meta + content to WP payload shape
 * - ensures categories & tags exist (creates them if needed)
 * - adds selected metadata to WP "meta" object (safe, non-plugin-specific)
 */
async function buildPostPayload(input: R8PublishInput) {
  const { polishedBlog, meta, publishAt, statusOverride } = input;

  // Convert markdown -> HTML if likely markdown (heuristic: contains '#' headings or '###' or blank lines).
  let contentHTML = polishedBlog;
  const looksLikeMarkdown = /(^#{1,6}\s)|(^\s*[-*]\s+)|(^\s*>)/m.test(polishedBlog);
  if (marked && looksLikeMarkdown) {
    contentHTML = marked.parse(polishedBlog);
  } else if (looksLikeMarkdown) {
    contentHTML = naiveMarkdownToHtml(polishedBlog);
  } // else assume it's already HTML

  const payload: Record<string, any> = {
    title: meta.title,
    content: contentHTML,
  };

  // excerpt prefers seoDescription
  if (meta.seoDescription) payload.excerpt = meta.seoDescription;

  // slug
  if (meta.slug) payload.slug = meta.slug;

  // scheduling / status
  if (publishAt) {
    payload.status = "future";
    payload.date = publishAt;
  } else if (statusOverride) {
    payload.status = statusOverride;
  } else {
    payload.status = "draft";
  }

  // categories -> convert primaryCategory string to category ID via WP helper
  if (meta.primaryCategory) {
    try {
      const catId = await wordpressClient.ensureCategory(meta.primaryCategory);
      payload.categories = [catId];
    } catch (err: any) {
      // If category creation/lookup fails, continue without categories but log
      // eslint-disable-next-line no-console
      console.warn("[r8_publish] category ensure failed:", { category: meta.primaryCategory, error: err?.message ?? err });
    }
  }

  // tags -> ensure each tag exists and gather IDs
  if (meta.tags && Array.isArray(meta.tags) && meta.tags.length > 0) {
    const tagIds: number[] = [];
    for (const tagName of meta.tags) {
      try {
        const tagId = await wordpressClient.ensureTag(tagName);
        tagIds.push(tagId);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.warn("[r8_publish] tag ensure failed:", { tag: tagName, error: err?.message ?? err });
      }
    }
    if (tagIds.length > 0) payload.tags = tagIds;
  }

  // Attach additional metadata (non-sensitive) in WP post.meta
  const metaObj: Record<string, any> = {};
  if (meta.seoKeywords) metaObj["seo_keywords"] = meta.seoKeywords.join(", ");
  if (meta.readingLevel) metaObj["reading_level"] = meta.readingLevel;
  // store featuredImage prompt descriptor (useful for downstream image generation step)
  if (meta.featuredImage) metaObj["featured_image_prompt"] = meta.featuredImage;
  if (meta.additionalImages) metaObj["additional_images_prompts"] = meta.additionalImages;

  if (Object.keys(metaObj).length > 0) payload.meta = metaObj;

  return payload;
}

/**
 * Round8_Publish flow
 */
export const r8_publish = ai.defineFlow(
  {
    name: "Round8_Publish",
    inputSchema: r8_publish_input,
    outputSchema: r8_publish_output,
  },
  async (input: R8PublishInput) => {
    const pipelineId = (input as any).pipelineId;
    if (!pipelineId) {
      console.warn("[r8_publish] Warning: pipelineId is missing. Storage will be skipped.");
    }
    try {
      // Build payload (incl. category/tag ensuring)
      const payload = await buildPostPayload(input);

      // Debug summary only (do not log credentials or full content)
      // eslint-disable-next-line no-console
      console.debug("[r8_publish] creating WP post:", {
        title: payload.title,
        status: payload.status,
        date: payload.date,
        slug: payload.slug,
        categories: payload.categories,
        tags: payload.tags,
        metaKeys: payload.meta ? Object.keys(payload.meta) : undefined,
      });

      // Create post via WP client
      const wpResponse = await wordpressClient.createPost(payload);

      const output = {
        pipelineId,
        id: typeof wpResponse.id === "number" ? wpResponse.id : undefined,
        link: wpResponse.link,
        status: wpResponse.status,
        date: wpResponse.date,
        slug: wpResponse.slug ?? payload.slug,
        title:
          (wpResponse.title && wpResponse.title.rendered) ||
          wpResponse.title ||
          payload.title,
        rawResponse: wpResponse,
        message: "Post created successfully",
      };

      const parsed = r8_publish_output.parse(output);

      let storageResult: any;
      if (pipelineId) {
        storageResult = await ai.run('Round8_Publish_Storage', async () => {
          const dataToStore = {
            publishInput: input,
            wordpressResponse: wpResponse,
          };
          const args = { pipelineId, round: 'r8', data: dataToStore, inputMeta: input };
          const { pipelineId: pId, round, data } = args;
          const startedAt = new Date().toISOString();

          try {
            const persistResult = await persistRoundOutput(pId, round, data);
            return {
              ok: true,
              pipelineId: pId,
              round,
              persistResult,
              startedAt,
              finishedAt: new Date().toISOString(),
            };
          } catch (err: any) {
            console.error(`[r8_publish:Round8_Publish_Storage] persistRoundOutput failed:`, err);
            return {
              ok: false,
              pipelineId: pId,
              round,
              error: err.message ?? String(err),
              startedAt,
              finishedAt: new Date().toISOString(),
            };
          }
        });
        console.log('[r8_publish] Round8_Publish_Storage span result:', storageResult);
      } else {
        storageResult = { ok: false, error: "Skipped: pipelineId was not provided." };
      }

      return {
        ...parsed,
        __storage: storageResult,
      };
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[r8_publish] Error creating post", {
        message: err?.message,
        responseData: err?.response?.data ?? undefined,
      });

      const errorMessage =
        (err?.response?.data as any)?.message ||
        err?.message ||
        "Unknown error while creating WordPress post";

      return r8_publish_output.parse({
        pipelineId,
        message: `Publish failed: ${errorMessage}`,
        rawResponse: err?.response?.data ?? { error: err?.message ?? String(err) },
      });
    }
  }
);

export default r8_publish;