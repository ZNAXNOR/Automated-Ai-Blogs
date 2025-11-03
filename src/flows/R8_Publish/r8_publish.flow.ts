/**
 * @file Publishes the final blog post to a WordPress site.
 * @author Omkar Dalvi
 *
 * This flow (Round 8) is the final step in the pipeline, responsible for sending the
 * polished content and metadata to a WordPress instance. It performs the following steps:
 * 1. Converts the blog content from Markdown to HTML.
 * 2. Constructs a payload for the WordPress REST API, mapping metadata (title, slug, etc.)
 *    to the correct fields.
 * 3. Ensures that all specified tags and categories exist in WordPress, creating them if necessary,
 *    to avoid publishing errors.
 * 4. Attaches additional generated metadata (like SEO keywords and image prompts) to the post's
 *    meta fields for downstream use.
 * 5. Calls the WordPress client to create the post, handling status (e.g., draft, pending, future).
 * 6. Parses the response from WordPress and returns a structured output with the post ID, link, and status.
 * 7. Persists the publishing details to a storage bucket.
 */

import { ai } from "../../clients/genkitInstance.client";
import { r8_publish_input, r8_publish_output, R8PublishInput } from "../../schemas/flows/r8_publish.schema";
import wordpressClient from "../../clients/wordpress.client";
import { round8StorageStep } from './r8_storage.step';
import { marked } from 'marked';

console.log('[r8_publish] Flow module loaded');

/**
 * Converts a Markdown string to HTML using the `marked` library.
 * @param markdown The Markdown content to convert.
 * @returns The converted HTML string.
 */
async function convertMarkdownToHtml(markdown: string): Promise<string> {
  if (!markdown) return '';
  // Use marked for robust Markdown-to-HTML conversion.
  return await marked.parse(markdown, { gfm: true, breaks: true });
}

/**
 * Builds the payload for the WordPress createPost API call.
 * This function maps the pipeline's data to the structure required by the WordPress REST API.
 * @param input The input data for the publish flow.
 * @returns A promise that resolves to the structured payload for the WP API.
 */
async function buildPostPayload(input: R8PublishInput): Promise<Record<string, any>> {
  const { polishedBlog, meta, publishAt, statusOverride } = input;

  const contentHTML = await convertMarkdownToHtml(polishedBlog);

  const payload: Record<string, any> = {
    title: meta.title,
    content: contentHTML,
    excerpt: meta.seoDescription,
    slug: meta.slug,
    // Set post status: 'future' if scheduled, otherwise use override or default to 'pending'.
    status: statusOverride ?? (publishAt ? 'future' : 'pending'),
    date: publishAt, // WordPress handles null dates correctly if the status isn't 'future'.
  };

  // Ensure the primary category exists in WordPress and get its ID.
  if (meta.primaryCategory) {
    try {
      const categoryId = await wordpressClient.ensureCategory(meta.primaryCategory);
      payload.categories = [categoryId];
    } catch (err) {
      console.warn(`[r8_publish] Could not ensure category "${meta.primaryCategory}":`, err);
    }
  }

  // Ensure all tags exist in WordPress and get their IDs.
  if (meta.tags && meta.tags.length > 0) {
    const tagIds = await Promise.all(meta.tags.map(tag => wordpressClient.ensureTag(tag)));
    payload.tags = tagIds.filter(id => id !== null);
  }

  // Attach additional details to the post's meta fields for internal use or SEO plugins.
  payload.meta = {
    seo_keywords: meta.seoKeywords?.join(', ') ?? '',
    reading_level: meta.readingLevel ?? 'N/A',
    featured_image_prompt: meta.featuredImage?.aiPrompt ?? '',
  };

  return payload;
}

/**
 * The main flow for Round 8, responsible for publishing the blog post to WordPress.
 */
export const r8_publish = ai.defineFlow(
  {
    name: "Round8_Publish",
    inputSchema: r8_publish_input,
    outputSchema: r8_publish_output,
  },
  async (input: R8PublishInput) => {
    const { pipelineId } = input;
    console.log(`[r8_publish] Starting publish flow for pipeline: ${pipelineId}`);

    try {
      // Build the final payload for the WordPress API.
      const payload = await buildPostPayload(input);
      console.log(`[r8_publish] Creating post "${payload.title}" with status "${payload.status}".`);

      // Call the WordPress client to create the post.
      const wpResponse = await wordpressClient.createPost(payload);
      
      // Parse and validate the response from WordPress.
      const output = r8_publish_output.parse({
        pipelineId,
        id: wpResponse.id,
        link: wpResponse.link,
        status: wpResponse.status,
        date: wpResponse.date,
        slug: wpResponse.slug,
        title: wpResponse.title?.rendered ?? payload.title,
        message: "Post created successfully.",
        rawResponse: wpResponse,
      });

      console.log(`[r8_publish] Successfully created post. ID: ${output.id}, Link: ${output.link}`);
      
      // Persist the publishing details to storage.
      const storageResult = await round8StorageStep(pipelineId, { input, output });

      return { ...output, __storage: storageResult };

    } catch (err: any) {
      console.error("[r8_publish] Failed to create WordPress post:", err);
      
      const errorMessage = err?.response?.data?.message || err.message || "Unknown error.";
      
      // Return a structured error message if publishing fails.
      return r8_publish_output.parse({
        pipelineId,
        message: `Publish failed: ${errorMessage}`,
        rawResponse: err?.response?.data ?? { error: String(err) },
      });
    }
  }
);

export default r8_publish;
