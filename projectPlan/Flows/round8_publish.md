# 🧩 Round 8 — Publish Flow

**Flow ID:** `r8_publish`

**Objective:** Finalize and publish the polished blog post to WordPress (as a draft or scheduled post) via REST API integration.

---

## 🧠 Purpose

This flow serves as the **final step in the content pipeline**, responsible for transferring AI-generated, human-reviewed blog posts into the live CMS (WordPress) environment.

It focuses on safe, reliable content deployment — ensuring that the content is available for human review or automatically scheduled for future publishing.

---

## ⚙️ Core Responsibilities

1. **Authenticate** with WordPress REST API using environment credentials stored in `dev.nix`.
2. **Publish post** as:

   * A **draft** (default), or
   * A **scheduled post** (if `publishAt` date provided).
3. **Return metadata** such as post ID, URL, and status.
4. **Ensure fail-safe operation** — validate fields and log masked env data for debugging.
5. Prepare for **future extensions**, including:

   * Slack / Firestore-based human confirmation workflow.
   * Multi-platform publishing (Medium, LinkedIn, Ghost).
   * Post-publish automation (SEO pings, auto-share, indexing).

---

## 🧩 Flow Input Schema

```ts
{
  title: string;              // Blog title (from r5 output)
  content: string;            // Final HTML content
  excerpt?: string;           // Optional short summary or meta description
  slug?: string;              // Optional SEO slug
  status?: "draft" | "future"; // Optional, defaults to "draft"
  publishAt?: string;         // ISO date for scheduled publish (optional)
  categories?: string[];      // Optional WordPress category slugs
  tags?: string[];            // Optional WordPress tags
}
```

---

## 🧾 Flow Output Schema

```ts
{
  id: number;                 // WordPress post ID
  link: string;               // Post URL
  status: string;             // "draft" | "future" | "publish"
  scheduledAt?: string;       // ISO time if scheduled
  message: string;            // Summary of action
}
```

---

## 🔐 Environment Variables (from `dev.nix`)

The credentials and API endpoint are securely stored in your development environment:

```ts
WP_API_URL = "https://odlabagency.wpcomstaging.com/";
WP_USERNAME = "odomkardalvi";
WP_PASSWORD = "e1qh vQqP DcAU **** **** ****";
```

These are injected into the Genkit/Firebase runtime automatically via:

```ts
process.env.WP_API_URL
process.env.WP_USERNAME
process.env.WP_PASSWORD
```

---

## 🔄 Flow Logic Overview

1. **Receive r5 output** (final blog post data).
2. **Construct WordPress payload**:

   ```json
   {
     "title": "Sample Title",
     "content": "<p>Blog HTML here</p>",
     "status": "draft",
     "date": "2025-10-25T09:00:00" // if scheduled
   }
   ```
3. **Authenticate** using Basic Auth:

   ```
   Authorization: Basic base64(username:password)
   ```
4. **Send POST** request to:

   ```
   POST {WP_API_URL}/wp-json/wp/v2/posts
   ```
5. **Handle response**:

   * On success → return `id`, `link`, and `status`.
   * On failure → log reason and return structured error.

---

## 🧱 Example Flow (Simplified)

```ts
import axios from "axios";

const wpApiUrl = process.env.WP_API_URL;
const authHeader = Buffer.from(
  `${process.env.WP_USERNAME}:${process.env.WP_PASSWORD}`
).toString("base64");

const postPayload = {
  title: input.title,
  content: input.content,
  status: input.publishAt ? "future" : "draft",
  date: input.publishAt || undefined,
  excerpt: input.excerpt,
  slug: input.slug,
  categories: input.categories,
  tags: input.tags
};

const res = await axios.post(`${wpApiUrl}/wp-json/wp/v2/posts`, postPayload, {
  headers: { Authorization: `Basic ${authHeader}` }
});
```

---

## 🧩 Future Enhancements

| Feature                       | Description                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| **Human Confirmation Step**   | Add Slack or Firestore trigger for “Approve & Schedule.”      |
| **Cross-Platform Publishing** | Extend support to Medium, Ghost, or LinkedIn.                 |
| **Post-Publish SEO Hooks**    | Auto-ping search engines, generate sitemap updates.           |
| **Auto-Share**                | Share to X/LinkedIn using round `r6_social`.                  |
| **Analytics Feedback Loop**   | Collect SEO and engagement metrics for evaluator re-training. |

---

## 🧑‍💼 Industry Reference

Professional pipelines (like **HubSpot**, **Jasper**, or **Buffer-integrated CMS**) typically follow this pattern:

1. AI generates → CMS draft.
2. Human reviews → approves via dashboard.
3. Pipeline updates post → “future” status with exact publish time.
4. WordPress cron auto-publishes → no manual trigger needed.
5. SEO indexing + social sharing run asynchronously after publish.

Your current MVP setup (AI draft → manual review → API draft publish) is fully aligned with this structure and future-ready for automation.

---

## ✅ Round Summary

| Phase          | Purpose                       | Output                              |
| -------------- | ----------------------------- | ----------------------------------- |
| **r5_polish**  | Finalize content and metadata | Complete blog HTML + metadata       |
| **r8_publish** | Deploy blog to WordPress      | Draft or scheduled post             |
| **Future r9+** | Post-publish automation       | Social share, analytics, evaluators |