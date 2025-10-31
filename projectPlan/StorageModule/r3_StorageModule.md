# 🧠 Round 3 (r3_draft) — Storage Integration Plan

## 🔍 Overview

**r3_draft** transforms a content outline and research notes (from r2) into a **full-length first draft**.

This round's primary storage responsibility is to persist the generated **draft artifact to Google Cloud Storage (GCS)**. It no longer writes separate metadata to Firestore, as the essential grounding metadata (the research notes) has already been stored by the r2 flow.

---

## 🧱 Core Responsibilities

| Storage Type | Purpose                           | Data Type                | Example Path                                    |
|--------------|-----------------------------------|--------------------------|-------------------------------------------------|
| **GCS**      | Full article draft (AI-generated) | `r3_draft` JSON artifact | `gs://ai-blog-bucket/drafts/{pipelineId}_r3.json` |

---

## 🧩 Data Flow

1.  **Receive Input:**
    From r2 — a `pipelineId`, an `outline`, and `researchNotes`.

2.  **Generate Draft:**
    The flow orchestrates AI prompts to write each section of the article and then assembles them into a `fullDraft`.

3.  **Execute Inline Subflow — `Round3_Storage`:**
    An inline Genkit subflow (`ai.run`) delegates the storage task to the `persistRoundOutput` adapter.

    -   **GCS Upload Only:** The adapter saves the complete AI output (`finalDraft`) to a GCS path. The adapter will see the `round: 'r3'` parameter and know to **skip any Firestore operations** for this round.
        -   Path: `gs://ai-blog-bucket/drafts/{pipelineId}_r3.json`

4.  **Return Enriched Output:**
    The main flow returns its generated `finalDraft`, with the results of the GCS operation attached under the `__storage` key for traceability.

---

## ✅ Deliverable

-   The `r3_draft.flow.ts` file will implement the `Round3_Storage` inline subflow.
-   The `persistRoundOutput` adapter (not modified here) is responsible for interpreting the `round: 'r3'` parameter and only performing a GCS upload.
