// wordpress.client.ts
import axios, {AxiosInstance} from "axios";
import { WP_API_URL_CONFIG, WP_PASSWORD_CONFIG, WP_USERNAME_CONFIG } from "@src/index.js";

/**
 * Lightweight WordPress REST client with helpers:
 * - createPost(payload)
 * - ensureCategory(name) -> returns category ID (creates if missing)
 * - ensureTag(name) -> returns tag ID (creates if missing)
 *
 * Requires env:
 * - WP_API_URL
 * - WP_USERNAME
 * And secret:
 * - WP_PASSWORD
 *
 * NOTE: Does not upload media. `featuredImage` in meta is a prompt
 * descriptor, not an upload.
 */

let instance: AxiosInstance | null = null;

/**
 * Creates a basic auth header.
 * @param {string} username The WordPress username.
 * @param {string} password The WordPress password.
 * @return {string} The basic auth header.
 */
function makeAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Lazily initializes and returns the Axios instance for WordPress API.
 * This ensures secrets are available at runtime.
 * @return {AxiosInstance} The initialized Axios instance.
 */
function getApiClient(): AxiosInstance {
  if (instance) {
    return instance;
  }

  const apiUrl = WP_API_URL_CONFIG.value();
  const username = WP_USERNAME_CONFIG.value();
  const password = WP_PASSWORD_CONFIG.value();

  if (!apiUrl) {
    throw new Error("Missing environment variable: WP_API_URL");
  }
  if (!username) {
    throw new Error("Missing environment variable: WP_USERNAME");
  }
  if (!password) {
    throw new Error(
      "WordPress password secret (WP_PASSWORD) is not available. " +
      "Ensure it is set in your Firebase environment."
    );
  }

  instance = axios.create({
    baseURL: apiUrl.replace(/\/+$/, ""),
    timeout: 20_000,
    headers: {
      "Content-Type": "application/json",
      "Authorization": makeAuthHeader(username, password),
    },
  });

  return instance;
}

interface WPCategory {
  id: number;
  name: string;
}

interface WPTag {
  id: number;
  name: string;
}

interface WPPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  slug: string;
  status: string;
  date: string;
  link: string;
}

/**
 * createPost - POST /wp-json/wp/v2/posts
 * @param {Record<string, unknown>} payload The post payload.
 * @return {Promise<WPPost>} The created post data.
 */
export async function createPost(
  payload: Record<string, unknown>
): Promise<WPPost> {
  console.debug("[wordpress.client] createPost payload summary:", {
    title: payload.title,
    status: payload.status,
    date: payload.date,
    slug: payload.slug,
  });
  const client = getApiClient();
  const resp = await client.post("/wp-json/wp/v2/posts", payload);
  return resp.data;
}

/**
 * ensureCategory - find category by exact name (search) and return its ID.
 * If not found, create it.
 * @param {string} name The category name.
 * @return {Promise<number>} The category ID.
 */
export async function ensureCategory(name: string): Promise<number> {
  if (!name) throw new Error("Category name required");
  const client = getApiClient();
  // Search (WP returns fuzzy matches; we attempt to find exact match)
  const searchResp = await client.get("/wp-json/wp/v2/categories", {
    params: {search: name, per_page: 10},
  });
  const candidates = searchResp.data as WPCategory[];
  // prefer exact (case-insensitive) match
  const exact = candidates.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  if (exact?.id) return exact.id;

  // Not found -> create
  const createResp = await client.post("/wp-json/wp/v2/categories", {name});
  return createResp.data.id;
}

/**
 * ensureTag - find tag by name, return ID, create if missing
 * @param {string} name The tag name.
 * @return {Promise<number>} The tag ID.
 */
export async function ensureTag(name: string): Promise<number> {
  if (!name) throw new Error("Tag name required");
  const client = getApiClient();
  const searchResp = await client.get("/wp-json/wp/v2/tags", {
    params: {search: name, per_page: 10},
  });
  const candidates = searchResp.data as WPTag[];
  const exact = candidates.find(
    (t) => t.name.toLowerCase() === name.toLowerCase()
  );
  if (exact?.id) return exact.id;

  const createResp = await client.post("/wp-json/wp/v2/tags", {name});
  return createResp.data.id;
}

export default {
  createPost,
  ensureCategory,
  ensureTag,
};
