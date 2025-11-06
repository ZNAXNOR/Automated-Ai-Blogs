/**
 * @file Publishes the final blog post to a WordPress site.
 * @author Omkar Dalvi
 *
 * This flow (Round 8) is the final step in the pipeline, responsible for
 * sending the polished content and metadata to a WordPress instance. It
 * performs the following steps:
 * 1. Converts the blog content from Markdown to HTML.
 * 2. Constructs a payload for the WordPress REST API, mapping metadata
 *    (title, slug, etc.) to the correct fields.
 * 3. Ensures that all specified tags and categories exist in WordPress,
 *    creating them if necessary, to avoid publishing errors.
 * 4. Attaches additional generated metadata (like SEO keywords and image
 *    prompts) to the post's meta fields for downstream use.
 * 5. Calls the WordPress client to create the post, handling status
 *    (e.g., draft, pending, future).
 * 6. Parses the response from WordPress and returns a structured output with
 *    the post ID, link, and status.
 * 7. Persists the publishing details to a storage bucket.
 */

import {ai} from "../../clients/genkitInstance.client";
import {
  r8PublishInput,
  r8PublishOutput,
  R8PublishInput,
  R8PublishOutput,
} from "../../schemas/flows/r8_publish.schema";
import {
  ensureCategory,
  ensureTag,
  createPost,
} from "../../clients/wordpress.client";
import {round8StorageStep} from "./r8_storage.step";
import {marked} from "marked";

console.log("[r8Publish] Flow module loaded");

/**
 * Converts a Markdown string to HTML using the `marked` library.
 * @param {string} markdown The Markdown content to convert.
 * @return {Promise<string>} The converted HTML string.
 */
async function convertMarkdownToHtml(markdown: string): Promise<string> {
  if (!markdown) return "";
  // Use marked for robust Markdown-to-HTML conversion.
  return await marked.parse(markdown, {gfm: true, breaks: true});
}

/**
 * Builds the payload for the WordPress createPost API call.
 * This function maps the pipeline's data to the structure required by the
 * WordPress REST API.
 * @param {R8PublishInput} input The input data for the publish flow.
 * @return {Promise<Record<string, unknown>>} A promise that resolves to the
 * structured payload for the WP API.
 */
async function buildPostPayload(
  input: R8PublishInput
): Promise<Record<string, unknown>> {
  const {polishedBlog, meta, publishAt, statusOverride} = input;

  const contentHTML = await convertMarkdownToHtml(polishedBlog);

  const payload: Record<string, unknown> = {
    title: meta.title,
    content: contentHTML,
    excerpt: meta.seoDescription,
    slug: meta.slug,
    // Set post status: 'future' if scheduled, otherwise use override or
    // default to 'pending'.
    status: statusOverride ?? (publishAt ? "future" : "pending"),
    date: publishAt, // WP handles null dates if status isn't 'future'.
  };

  // Ensure the primary category exists in WordPress and get its ID.
  if (meta.primaryCategory) {
    try {
      const categoryId = await ensureCategory(meta.primaryCategory);
      payload.categories = [categoryId];
    } catch (err) {
      console.warn(
        `[r8Publish] Could not ensure category "${meta.primaryCategory}":`,
        err
      );
    }
  }

  // Ensure all tags exist in WordPress and get their IDs.
  if (meta.tags && meta.tags.length > 0) {
    const tagIds = await Promise.all(meta.tags.map((tag) => ensureTag(tag)));
    payload.tags = tagIds.filter((id) => id !== null);
  }

  // Attach additional details to the post's meta fields for internal use or
  // SEO plugins.
  payload.meta = {
    seo_keywords: meta.seoKeywords?.join(", ") ?? "",
    reading_level: meta.readingLevel ?? "N/A",
    featured_image_prompt: meta.featuredImage?.aiPrompt ?? "",
  };

  return payload;
}

/**
 * The main flow for Round 8, responsible for publishing the blog post to
 * WordPress.
 */
export const r8Publish = ai.defineFlow(
  {
    name: "round8Publish",
    inputSchema: r8PublishInput,
    outputSchema: r8PublishOutput,
  },
  async (input: R8PublishInput): Promise<R8PublishOutput> => {
    const {pipelineId} = input;
    console.log(
      `[r8Publish] Starting publish flow for pipeline: ${pipelineId}`
    );

    try {
      // Build the final payload for the WordPress API.
      const payload = await buildPostPayload(input);
      console.log(
        `[r8Publish] Creating post "${payload.title}" ` +
          `with status "${payload.status}".`
      );

      // Call the WordPress client to create the post.
      const wpResponse = await createPost(payload);

      // Parse and validate the response from WordPress.
      const output: R8PublishOutput = {
        pipelineId,
        id: wpResponse.id,
        link: wpResponse.link,
        status: wpResponse.status,
        date: wpResponse.date,
        slug: wpResponse.slug,
        title: wpResponse.title?.rendered ?? String(payload.title),
        message: "Post created successfully.",
        rawResponse: wpResponse,
      };

      console.log(
        `[r8Publish] Successfully created post. ID: ${output.id}, ` +
          `Link: ${output.link}`
      );

      // Persist the publishing details to storage.
      await round8StorageStep(pipelineId, {input, output});

      return output;
    } catch (err: unknown) {
      console.error("[r8Publish] Failed to create WordPress post:", err);

      const error = err as {response?: {data?: {message?: string}}};
      const errorMessage =
        error?.response?.data?.message ||
        (err as Error).message ||
        "Unknown error.";

      // Return a structured error message if publishing fails.
      const output: R8PublishOutput = {
        pipelineId,
        message: `Publish failed: ${errorMessage}`,
        rawResponse: (err as {response?: {data?: unknown}})?.response?.data ?? {
          error: String(err),
        },
      };
      return output;
    }
  }
);

export default r8Publish;
