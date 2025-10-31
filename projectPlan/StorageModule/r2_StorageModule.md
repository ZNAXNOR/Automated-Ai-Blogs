# 🧠 Round 2 (r2_angle) — Storage Integration Plan

## 🔍 Overview

**r2_angle** transforms ideation inputs (from r1) into validated content angles, complete with an article outline and grounded research. This round is critical for establishing the factual basis of an article.

The storage module for r2 persists the **full angle and outline object to GCS** while saving the curated **research notes as lightweight metadata in Firestore**.

---

## 🧱 Core Responsibilities

| Storage Type  | Purpose                                      | Data Type                             | Example Path                                     |
| ------------- | -------------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| **GCS**       | Full AI-generated output (angle, outline)    | `r2_angle` JSON artifact              | `gs://ai-blog-bucket/angles/{pipelineId}_r2.json`  |
| **Firestore** | Grounding metadata (curated research notes)  | `researchNotes` array & core metadata | `/angles/{pipelineId}/r2_meta`                   |

---

## 🧩 Data Flow

1.  **Receive Input:**
    From r1 — a validated topic idea with a `pipelineId`.

2.  **Generate Angle & Research Notes:**
    The flow scrapes source URLs to produce a `researchNotes` array and then uses an AI prompt to generate a content `outline`.

3.  **Structure the Data for Persistence:**
    The flow combines the AI output and the research notes into a single object.

    ```ts
    const dataToPersist = {
      ...resultFromAI, // Contains the outline
      researchNotes,   // The array of scraped notes
      pipelineId,
    };
    ```

4.  **Execute Inline Subflow — `Round2_Storage`:**
    An inline Genkit subflow (`ai.run`) handles the persistence logic, which is delegated to the `persistRoundOutput` adapter.

    -   **GCS Upload:** The adapter saves the complete `dataToPersist` object to a GCS path.
        -   Path: `gs://ai-blog-bucket/angles/{pipelineId}_r2.json`
    -   **Firestore Metadata Write:** The adapter extracts just the `researchNotes` and other key fields from the `dataToPersist` object and writes them to Firestore.
        -   Collection: `/angles`
        -   Document ID: `{pipelineId}`
        -   Subcollection: `/r2_meta`

5.  **Return Enriched Output:**
    The main flow returns its generated output, with the results of the storage operation attached under the `__storage` key for traceability.

---

## ✅ Deliverable

-   The `r2_angle.flow.ts` file must be updated to add the `researchNotes` to the object that gets passed to the `persistRoundOutput` adapter.
-   The `persistRoundOutput` adapter (not modified here) will handle the conditional logic of storing `researchNotes` to Firestore only for `round: 'r2'`.
