# 🧠 Round 4 (r4_meta) — Storage Integration Plan

## 🔍 Overview

**r4_meta** consolidates all prior round outputs — topic, ideation, angles, and draft — into a unified **metadata summary and enrichment round**.  
It extracts, merges, and refines the article’s **contextual metadata**, including SEO tags, category associations, image references, and publication readiness details.

This round acts as the **central metadata bridge** between the content pipeline and the eventual publishing workflow.  
It stores both **structured metadata (Firestore)** and **full enriched object (GCS)**.

---

## 🧱 Core Responsibilities

| Storage Type | Purpose | Data Type | Example Path |
|---------------|----------|------------|---------------|
| **GCS** | Full metadata artifact (merged content + image refs + keywords + meta structure) | `r4_meta` JSON object | `gs://ai-blog-bucket/meta/{pipelineId}_r4.json` |
| **Firestore** | Curated metadata subset for queries and indexing | SEO fields, tags, language, status | `/meta/{pipelineId}/r4_meta` |

---

## 🧩 Data Flow

1. **Receive Input:**  
   Consolidated data from r0–r3 (topic, ideation, draft) including their references.

2. **Generate Metadata:**  
   AI output structured as:
    ```ts
      interface R4MetaOutput {
        pipelineId: string;
        topic: string;
        title: string;
        seoTitle: string;
        description: string;
        language: string;
        tags: string[];
        categories: string[];
        imageRefs: {
          url: string;
          alt: string;
        }[];
        references: string[];
        createdAt: string;
      }
    ```

3. **Inline Subflow — `r4_storage_inline`:**
   Create an inline **Genkit subflow** that:

   * Uploads the **complete enriched metadata object** to **GCS**

     * Path format:

       ```
       gs://ai-blog-bucket/meta/{pipelineId}_r4.json
       ```
   * Stores **curated Firestore metadata** for lightweight retrieval:

     ```ts
     {
       pipelineId: string;
       title: string;
       language: string;
       tagCount: number;
       categoryCount: number;
       imageCount: number;
       seoTitle: string;
       storagePath: string;
       createdAt: string;
       status: 'in_review' | 'published';
     }
     ```
   * Collection: `/meta`
   * Document ID: `{pipelineId}`
   * Subcollection: `/r4_meta`

4. **Cross-Linking:**

   * Firestore doc includes the `storagePath` to the GCS artifact.
   * GCS file naming follows the `{pipelineId}_r4.json` convention.

5. **Response Object (Returned by Subflow):**

   ```ts
   {
     pipelineId: string;
     firestoreId: string;
     gcsPath: string;
     tagCount: number;
     categoryCount: number;
     imageCount: number;
     timestamp: string;
   }
   ```

---

## 🧰 Required Imports

```ts
import { db, collections } from '../clients/firestore.client';
import { bucket, uploadJSON } from '../clients/gcs.client';
import { makeGCSPath } from '../helpers/gcs.helpers';
import { GCSArtifactSchema } from '../schemas/gcs.schema';
```

---

## 🧱 Expected Output File

**File:** `flows/r4_storage.flow.ts`

The inline subflow should:

* Be named `r4_storage_inline`
* Be registered with `ai.defineFlow({ name: 'Round4_Meta_Storage', ... })`
* Execute within the main r4 flow (not a standalone module)
* Upload metadata JSON → GCS
* Write curated subset → Firestore
* Return structured confirmation

---

## 🧪 Emulator Integration

* If **Firebase Emulator** is active, automatically route Firestore + GCS writes to emulator endpoints.
* Maintain consistent GCS-style path naming for cross-round uniformity.

---

## 💡 Example Invocation

```ts
import { saveR4MetaResult } from './flows/r4_storage.flow';

const result = await saveR4MetaResult({
  pipelineId: 'topic_789',
  topic: 'AI in Social Media Strategy',
  title: 'Optimizing Social Media Campaigns with AI Insights',
  seoTitle: 'AI for Social Media Optimization in 2025',
  description: 'A metadata-rich overview of AI-driven campaign performance in digital marketing.',
  language: 'en',
  tags: ['ai', 'social media', 'marketing', 'automation'],
  categories: ['Digital Marketing', 'AI Insights'],
  imageRefs: [
    { url: 'https://example.com/images/ai-marketing.jpg', alt: 'AI Marketing Concept' },
    { url: 'https://example.com/images/analytics.jpg', alt: 'Marketing Analytics Dashboard' }
  ],
  references: [
    'https://gnews.com/example-article',
    'https://search.google.com/example-source'
  ],
  createdAt: new Date().toISOString(),
});

console.log('r4 storage confirmation:', result);
```

---

## 🧩 Notes

* **Firestore segmentation:** `/meta`
* **GCS segmentation:** `/meta/`
* **Inline Subflow:** `r4_storage_inline` → visible in Genkit UI trace
* **Curated Firestore subset:** optimized for display, tags, and lightweight querying
* **No duplication of full metadata in Firestore**

---

## ✅ Deliverable

Generate a complete **TypeScript implementation** of:
`flows/r4_storage.flow.ts`

The file must follow this `.md` specification exactly — consistent naming, subflow traceability, GCS + Firestore handling, and emulator support.
