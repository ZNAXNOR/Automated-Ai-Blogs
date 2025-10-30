# Storage & Data Architecture Plan

## For AI-Powered Blog Pipeline (Rounds r0 → r8)

### 1. Purpose

Define **how and what** to store in Google Cloud Firestore (structured metadata & operations) and Google Cloud Storage (artifact blobs) across all rounds (r0 to r8).
Also define UID strategy and operations tracking (topic usage, pruning, duplication detection).
This aligns with professional content-ops pipeline best practices (metadata in DB; large blobs in object storage).
([Firebase][1])

---

### 2. UID Strategy

**Hybrid approach**:

* Generate an internal `pipelineId` (custom UID) at the very start (e.g., when r0 starts for a new blog topic).
* Use this `pipelineId` consistently across all Firestore documents and GCS blob paths.
* When the blog is published in WordPress at r8, update the same record with `wpPostId`, `wpUrl`, `status = "published"`.
* Use `pipelineId` as primary key internally; `wpPostId` is a foreign reference.
  **Rationale:** Enables early-round linking, maintains consistency, supports multi-platform later.

---

### 3. Firestore Collections & Documents

#### Collections

* `topics` — holds both *fetched* topics and *used* topics. Use status field (`unused`, `used`) to distinguish.
* `articles` — one document per `pipelineId`. Stores orchestrated round summary metadata, status, links to blob outputs, publish info.
* `operations` — track system-level operations: pruning events, duplication detections, archival actions.

#### Sample `articles/{pipelineId}` document

```json
{
  "pipelineId": "abc12345",
  "title": "...",
  "category": "Social Media Marketing",
  "tags": ["ai", "automation", "social"],
  "status": "draft" | "scheduled" | "published",
  "wpPostId": 231,
  "wpUrl": "https://...",
  "roundRefs": {
    "r0": "gs://bucket/topics/abc12345_r0.json",
    "r1": "gs://bucket/topics/abc12345_r1.json",
    "r4": "gs://bucket/meta/abc12345_r4.json",
    "r5": "gs://bucket/polished/abc12345_r5.json",
    "r8": "gs://bucket/published/abc12345_r8.json"
  },
  "createdAt": "2025-10-24T08:00:00Z",
  "updatedAt": "2025-10-24T08:15:00Z"
}
```

#### Sample `topics/{topicId}` document

```json
{
  "topicId": "t98765",
  "category": "SEO and Organic Marketing",
  "title": "humanize AI tools for seo",
  "status": "unused" | "used",
  "usedAt": "2025-10-24T07:55:00Z" // optional if used
}
```

#### Sample `operations/{operationId}` document

```json
{
  "operation": "prune_unused_topics",
  "category": "Paid Media Advertising",
  "prunedCount": 120,
  "timestamp": "2025-10-25T00:00:00Z"
}
```

---

### 4. GCS Blob Architecture

Use single bucket (e.g., `gs://odlabs-artifacts`), organised by round and pipelineId:

```
odlabs-artifacts/
  topics/
    abc12345_r0.json
    abc12345_r1.json
  outlines/
    abc12345_r2.json
    abc12345_r3.json
  meta/
    abc12345_r4.json
  polished/
    abc12345_r5.json
  published/
    abc12345_r8.json
  logs/
    abc12345_rX_log.txt
```

Each blob is referenced by `roundRefs` field in Firestore `articles` document, allowing UI retrieval if needed.

---

### 5. Round-by-Round Storage Map

| Round                  | Firestore Stored                     | GCS Blob Stored             |
| ---------------------- | ------------------------------------ | --------------------------- |
| r0_trends / r1_ideate  | Topics by category + status          | Full suggestions JSON blobs |
| r2_angle / r3_draft    | Outline summary + version info       | Full outline & draft blob   |
| r4_meta                | Metadata summary (title, slug, tags) | Full metadata blob          |
| r5_polish              | Final blog summary + status          | Full polished content blob  |
| r6_social (future)     | Social variant metadata              | Full social asset blobs     |
| r7_evaluation (future) | Score metadata                       | Full evaluation report blob |
| r8_publish             | Publish info (WP ID, URL, status)    | Full publish log blob       |

---

### 6. Operations & Topic-Tracking

* **Topics collection** handles all fetched topics and used topics → enables reuse, duplication avoidance.
* **Used topics** should be flagged `status = "used"` and timestamped.
* **Pruning logic**: regularly archive or delete topics that remain `unused` for X days. Log pruning operations in `operations` collection.
* **Duplication detection**: store reference of used topics and topic hashes in Firestore for lookup.
* **Versioning**: if blog content is updated, increment version in `articles` document (e.g., `version: 2`) and store a new blob in GCS; maintain history.

---

### 7. MVP → Future Roadmap

#### MVP Phase

* Implement `topics` and `articles` collections.
* Store round summaries in Firestore and blobs in GCS for r0 → r5 → r8.
* Basic topic status tracking and article status tracking.

#### Future Phase

* Implement `r6_social` and `r7_evaluation` flows with storage.
* Extend UI dashboard: query Firestore for articles by status, category, tags.
* Implement versioning, multi-platform publish (Medium, LinkedIn).
* Add lifecycle rules: GCS blob expiration, archival.
* Add analytics, user roles, audit logs, search indexing (e.g., Algolia).
* Security rules and IAM controls for access to Firestore & GCS. ([Firebase][2])

---

### 8. Best Practices & Considerations

* Avoid large Firestore documents (>1 MB); store heavy content in GCS. ([Estuary][3])
* Use automatic or hashed UIDs for collections to avoid Firestore hotspots. ([Firebase][1])
* Use appropriate indexes in Firestore for efficient queries (status, category, tags).
* Ensure bucket lifecycle rules to manage storage cost.
* Secure Firestore and GCS with rules and IAM (avoid storing sensitive data in plain blobs).
* When designing UI, use Firestore for quick metadata retrieval; fetch full blob only when needed.

---

### 9. Summary

This architecture enables:

* Unified linking across rounds via `pipelineId`.
* Efficient storage: metadata in Firestore, full artifacts in GCS.
* Operational tracking: topics, articles, pruning, duplication.
* Future scalability: new flows (r6/r7), multi-platform publishing, analytics.

Once you adopt this model, you have a robust foundation for both MVP and future growth.

[1]: https://firebase.google.com/docs/firestore/best-practices "Best practices for Cloud Firestore - Firebase - Google"
[2]: https://firebase.google.com/docs/firestore/security/get-started "Get started with Cloud Firestore Security Rules - Firebase"
[3]: https://estuary.dev/blog/firestore-query-best-practices "7+ Google Firestore Query Performance Best Practices for 2024"
