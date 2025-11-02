### 🧩 `r8_publish_storage.md`

#### 🎯 Goal

Integrate Firestore and GCS storage functionality into the **R8 (Publish)** flow.
This round consolidates and finalizes all previous rounds, preparing the blog for publication with full metadata and content integrity.

The purpose is to:

* Persist the **final publish payload** in both Firestore and GCS.
* Register final references for quick retrieval and UI display.
* Ensure full traceability with a dedicated inline subflow (`Round8_Publish_Storage`) visible in Genkit UI.

---

#### 🧱 Storage Design

##### **Firestore**

* **Path:**
  `topics/{topicId}/r8_publish`
* **Data Stored:**
  Only **essential metadata** for UI rendering and reference linking, not the entire blog body.
* **Schema Example:**

  ```ts
  {
    title: "AI in Digital Marketing — 2025 Edition",
    slug: "ai-in-digital-marketing-2025",
    summary: "A concise blog overview, optimized for previews.",
    coverImage: {
      url: "https://storage.googleapis.com/ai-blog-bucket/topics/ai-marketing-cover.png",
      alt: "AI marketing concept art"
    },
    publishStatus: "published",
    publishedAt: "2025-10-28T08:43:00.000Z",
    gcsRef: "gs://ai-blog-bucket/topics/{topicId}_r8.json"
  }
  ```
* **Notes:**

  * Only metadata and links are stored in Firestore (no full markdown or long text).
  * This document serves as the *publicly retrievable record* for frontend display.

##### **GCS (Google Cloud Storage)**

* **Path:**
  `gs://ai-blog-bucket/topics/{topicId}_r8.json`
* **Data Stored:**
  The **complete publish payload**, including all data needed for rehydration or audit.
* **Schema Example:**

  ```json
  {
    "id": "123",
    "title": "AI in Digital Marketing — 2025 Edition",
    "slug": "ai-in-digital-marketing-2025",
    "content": "Full markdown blog with final formatting and metadata...",
    "tags": ["AI", "Digital Marketing", "Automation"],
    "category": "Digital Marketing Analytics",
    "seo": {
      "metaTitle": "AI in Digital Marketing — 2025 Edition",
      "metaDescription": "An in-depth exploration of how AI transforms digital marketing strategies."
    },
    "images": [
      {
        "type": "cover",
        "url": "https://storage.googleapis.com/ai-blog-bucket/topics/ai-marketing-cover.png",
        "alt": "AI marketing concept art"
      }
    ],
    "publishStatus": "published",
    "publishedAt": "2025-10-28T08:43:00.000Z"
  }
  ```

---

#### 🔄 Flow Integration

##### **Inline Subflow**

A dedicated inline subflow named `Round8_Publish_Storage` will:

1. Receive the full R8 output payload.
2. Write:

   * Full JSON → **GCS**
   * Essential metadata → **Firestore**
3. Return both storage references:

   ```ts
   {
     gcsRef: "gs://ai-blog-bucket/topics/{topicId}_r8.json",
     fsRef: "topics/{topicId}/r8_publish"
   }
   ```

##### **Flow Tracing**

* The subflow appears as a **distinct trace** under the R8 flow in the Genkit UI.
* It includes detailed trace logs and references for cross-verification with earlier rounds.

---

#### ⚙️ Implementation Guidelines

* Follow the adapter/util architecture used across R0–R5.
* Inline subflow should use:

  * `gcsAdaptor.writeJSON()` for GCS.
  * `fsAdaptor.setDoc()` for Firestore metadata.
* Store only what’s relevant for retrieval and presentation — not debug or internal model data.
* Return both references for use in the final orchestration summary.

---

#### ✅ Summary

| Target         | Path                          | Stored Data                  | Purpose                     |
| :------------- | :---------------------------- | :--------------------------- | :-------------------------- |
| Firestore      | `topics/{topicId}/r8_publish` | Final metadata + refs        | Quick public retrieval      |
| GCS            | `topics/{topicId}_r8.json`    | Full publish payload         | Full content archive        |
| Inline Subflow | `Round8_Publish_Storage`      | Handles both FS + GCS writes | Traceable storage operation |
