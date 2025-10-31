# 🧩 Round 0 — Firestore + GCS Storage Integration Plan
**Flow Name:** `r0_discussion`  
**Primary Function:** Topic discussion & ideation seed  
**Storage Level:** High (full persistence required)  
**Integration Mode:** Dual (Firestore + GCS)

---

## 1. 🎯 Purpose
Round 0 (r0) generates **initial discussion data** — topic ideas, reasoning, and contextual threads for future pipeline rounds.

This data is foundational and must be **fully persisted** to ensure deterministic behavior of later flows (r1–r4).

---

## 2. 🗂️ Firestore Storage Specification

### ✅ Collection
`collections.topics`

### ✅ Document Schema (minimal + essential)
| Field | Type | Description |
|-------|------|-------------|
| `topicId` | `string` | Unique identifier (UUID / short hash) |
| `title` | `string` | Human-readable topic title |
| `category` | `string` | Category name (e.g. “SEO”, “Content Marketing”) |
| `status` | `"scheduled" \| "in_review"` | Initial stage status |
| `createdAt` | `string (ISO)` | Document creation timestamp |
| `updatedAt` | `string (ISO)` | Last updated timestamp |
| `gcsReference` | `string (optional)` | Full path or public URL to corresponding GCS JSON blob |
| `discussionSummary` | `string (optional)` | Human-readable short abstract of the discussion |
| `round` | `"r0"` | Static round label |

---

## 3. ☁️ GCS Storage Specification

### ✅ Folder
`gs://ai-blog-bucket/topics/`

### ✅ File Naming Convention
```

{topicId}_r0.json

```

### ✅ Example Path
```

gs://ai-blog-bucket/topics/a1b2c3d4_r0.json

````

### ✅ File Schema (full r0 payload)
```json
{
  "topicId": "a1b2c3d4",
  "title": "How AI Transforms Content Marketing Workflows",
  "round": "r0",
  "discussion": {
    "seedPrompt": "...",
    "modelResponse": "...",
    "reasoningSummary": "...",
    "tags": ["ai", "content marketing", "automation"]
  },
  "metadata": {
    "createdAt": "2025-10-28T09:15:00Z",
    "createdBy": "r0_discussion",
    "version": "1.0"
  }
}
````

---

## 4. 🔗 Firestore ↔ GCS Linkage

| Source    | Target      | Description                                                      |
| --------- | ----------- | ---------------------------------------------------------------- |
| Firestore | → GCS       | Firestore document contains `gcsReference` field linking to blob |
| GCS       | → Firestore | GCS file contains metadata mirrored from Firestore document      |

This allows the orchestrator or dashboard to retrieve:

* lightweight summaries from Firestore,
* and detailed payloads (JSON, transcripts, etc.) from GCS.

---

## 5. ⚙️ Flow Responsibilities

| Step | Operation                      | Target    | Description                                  |
| ---- | ------------------------------ | --------- | -------------------------------------------- |
| 1    | Generate topic discussion JSON | -         | Core AI generation step                      |
| 2    | Upload full discussion JSON    | GCS       | Save as `{topicId}_r0.json`                  |
| 3    | Write summary + metadata       | Firestore | Store curated summary, metadata & GCS ref    |
| 4    | Confirm consistency            | FS + GCS  | Validate both entries exist and cross-linked |

---

## 6. 🧪 Example Implementation Snippet

```ts
import { collections } from '../clients/firestore.client';
import { uploadFile } from '../clients/gcs.client';
import { makeGCSPath } from '../helpers/gcs.helpers';
import fs from 'fs/promises';

async function storeR0Discussion(topicId: string, data: any) {
  const gcsPath = makeGCSPath(topicId, 'r0', 'json');
  const localFile = `/tmp/${topicId}_r0.json`;

  await fs.writeFile(localFile, JSON.stringify(data, null, 2));
  const publicUrl = await uploadFile(localFile, `topics/${topicId}_r0.json`);

  await collections.topics().doc(topicId).set({
    topicId,
    title: data.title,
    status: 'in_review',
    category: data.category,
    gcsReference: publicUrl,
    discussionSummary: data.discussion.reasoningSummary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    round: 'r0',
  });
}
```

---

## 7. 🧭 Validation Checklist

* [x] Firestore document created in `topics`
* [x] GCS JSON uploaded in `topics/`
* [x] Cross-link references match
* [x] Emulator support functional (if enabled)

---

## 8. 🔮 Next Step

→ Proceed to **r1_storage_flow.md**, which refines discussion into ideation and reference mapping while maintaining similar FS+GCS parity.

---

>**Author:** OD Labs
>
>**Version:** 1.0
>
>**Last Updated:** 2025-10-28