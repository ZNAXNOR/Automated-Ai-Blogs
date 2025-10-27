// wordpress.client.ts
import axios, { AxiosInstance } from "axios";

/**
 * Lightweight WordPress REST client with helpers:
 * - createPost(payload)
 * - ensureCategory(name) -> returns category ID (creates if missing)
 * - ensureTag(name) -> returns tag ID (creates if missing)
 *
 * Requires env:
 * - WP_API_URL
 * - WP_USERNAME
 * - WP_PASSWORD
 *
 * NOTE: Does not upload media. featuredImage in meta is a prompt descriptor, not an upload.
 */

const WP_API_URL = process.env.WP_API_URL;
const WP_USERNAME = process.env.WP_USERNAME;
const WP_PASSWORD = process.env.WP_PASSWORD;

if (!WP_API_URL) {
  throw new Error("Missing environment variable: WP_API_URL");
}
if (!WP_USERNAME || !WP_PASSWORD) {
  throw new Error("Missing WP credentials: WP_USERNAME and/or WP_PASSWORD");
}

function makeAuthHeader(username: string, password: string) {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

function maskSecret(secret: string) {
  if (!secret) return "";
  if (secret.length <= 4) return "*".repeat(secret.length);
  return `${secret.slice(0, 2)}${"*".repeat(secret.length - 4)}${secret.slice(-2)}`;
}

const instance: AxiosInstance = axios.create({
  baseURL: WP_API_URL.replace(/\/+$/, ""),
  timeout: 20_000,
  headers: {
    "Content-Type": "application/json",
    Authorization: makeAuthHeader(WP_USERNAME, WP_PASSWORD),
  },
});

/**
 * createPost - POST /wp-json/wp/v2/posts
 */
export async function createPost(payload: Record<string, any>) {
  console.debug("[wordpress.client] createPost payload summary:", {
    title: payload.title,
    status: payload.status,
    date: payload.date,
    slug: payload.slug,
  });
  const resp = await instance.post("/wp-json/wp/v2/posts", payload);
  return resp.data;
}

/**
 * ensureCategory - find category by exact name (search) and return its ID.
 * If not found, create it.
 */
export async function ensureCategory(name: string): Promise<number> {
  if (!name) throw new Error("Category name required");
  // Search (WP returns fuzzy matches; we attempt to find exact match)
  const searchResp = await instance.get("/wp-json/wp/v2/categories", {
    params: { search: name, per_page: 10 },
  });
  const candidates = searchResp.data as Array<any>;
  // prefer exact (case-insensitive) match
  const exact = candidates.find(
    (c) => typeof c.name === "string" && c.name.toLowerCase() === name.toLowerCase()
  );
  if (exact && exact.id) return exact.id;

  // Not found -> create
  const createResp = await instance.post("/wp-json/wp/v2/categories", { name });
  return createResp.data.id;
}

/**
 * ensureTag - find tag by name, return ID, create if missing
 */
export async function ensureTag(name: string): Promise<number> {
  if (!name) throw new Error("Tag name required");
  const searchResp = await instance.get("/wp-json/wp/v2/tags", {
    params: { search: name, per_page: 10 },
  });
  const candidates = searchResp.data as Array<any>;
  const exact = candidates.find(
    (t) => typeof t.name === "string" && t.name.toLowerCase() === name.toLowerCase()
  );
  if (exact && exact.id) return exact.id;

  const createResp = await instance.post("/wp-json/wp/v2/tags", { name });
  return createResp.data.id;
}

export default {
  createPost,
  ensureCategory,
  ensureTag,
};
