# 🧩 `r5_polish_storage.md`

## 🎯 Goal

Integrate Firestore and GCS storage functionality into the **R5 (Polish)** flow.
This round processes and finalizes the blog content, including readability data and image metadata.

Unlike previous rounds, **only image metadata** (`usedImages`) will be persisted in Firestore — not the entire blog or readability content.

---

## 🧱 Storage Design

#### **Firestore**

* **Path:**
  `topics/{topicId}/r5_meta`
* **Data Stored:**
  Only image metadata from `usedImages` in the `polishOutputCore` schema.
* **Schema Example:**

  ```ts
  {
    usedImages: [
      {
        type: "ai_prompt",
        description: "A futuristic cityscape used in the blog header",
        aiPrompt: "futuristic neon skyline, night, rain, cinematic lighting",
        context: "header",
        alt: "Futuristic city skyline with neon lights"
      },
      {
        type: "meme",
        description: "Funny marketing meme used in conclusion",
        alt: "Marketer panicking over SEO"
      }
    ]
  }
  ```
* **Notes:**

  * Other fields (`polishedBlog`, `readability`) are *not stored* in Firestore.
  * Firestore only acts as a metadata index for used images.

#### **GCS (Google Cloud Storage)**

* **Path:**
  `gs://ai-blog-bucket/topics/{topicId}_r5.json`
* **Data Stored:**
  The full `polishOutputCore` JSON object:

  ```json
  {
    "polishedBlog": "Full markdown with hashtags and disclaimer...",
    "readability": {
      "fkGrade": 9.3
    },
    "usedImages": [...]
  }
  ```

---

## 🔄 Flow Integration

#### **Inline Subflow**

An **inline subflow** named `Round5_Polish_Storage` will:

1. Accept the full R5 output (`polishOutputCore`).
2. Write:

   * The **full JSON** to GCS.
   * Only the **`usedImages` metadata** to Firestore.
3. Return both references (`gcsPath`, `firestoreDocPath`) for traceability.

#### **Flow Tracing**

* This subflow appears as a **separate trace** under the `r5_polish` flow in Genkit UI.
* It will include structured logs and metadata markers similar to R0–R4.

---

## ⚙️ Implementation Guidelines

* Follow the established adapter pattern used in prior rounds.
* Use existing `fsAdaptor` and `gcsAdaptor` clients.
* Inline the subflow (not a new file).
* Return both references at the end of the main R5 flow:

  ```ts
  {
    gcsRef: "gs://ai-blog-bucket/topics/{id}_r5.json",
    fsRef: "topics/{id}/r5_meta"
  }
  ```

---

## ✅ Summary

| Target         | Path                       | Stored Data                  | Purpose                     |
| :------------- | :------------------------- | :--------------------------- | :-------------------------- |
| Firestore      | `topics/{topicId}/r5_meta` | `usedImages` metadata        | Quick metadata access       |
| GCS            | `topics/{topicId}_r5.json` | Full R5 output               | Full content backup         |
| Inline Subflow | `Round5_Polish_Storage`    | Handles both FS + GCS writes | Traceable storage operation |
