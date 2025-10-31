# 🧠 Round 1 (r1_ideate) — Storage Integration Plan (Inline Subflow)

## 🔍 Overview

**r1_ideate** builds directly upon **r0_trends**, transforming each trending topic into **structured article ideas or outlines**.

Unlike r0, this round **does not create a new document** — it **updates the existing Firestore document** initialized by r0.  
The ideation results are stored in full on **GCS**, while only summary metadata is added or updated in **Firestore**.

This ensures a clean data lineage where each topic document progressively accumulates round metadata.

---

## 🧱 Core Responsibilities

| Storage Type  | Purpose                                             | Data Type                                 | Example Path                                      |
| ------------- | --------------------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| **GCS**       | Full ideation output (AI-generated ideas JSON blob) | `r1_ideate` payload                       | `gs://ai-blog-bucket/topics/{pipelineId}_r1.json` |
| **Firestore** | Append minimal metadata to existing topic doc       | Topic ID, idea count, timestamps, GCS ref | `/topics/{pipelineId}`                            |

---

## 🧩 Data Flow

1. **Receive Input:**
   From r0 — carries `pipelineId` and `topic`.

2. **Generate Ideation Data:**
   AI output is structured as:

   ```ts
   interface R1IdeationOutput {
     pipelineId: string;
     topic: string;
     ideas: {
       title: string;
       angle: string;
       summary: string;
     }[];
     createdAt: string;
   }
   ```

3. **Persist Data:**
   Within `r1_ideate`, call an inline subflow named **`Round1_Storage`**:

   ```ts
   const storageResult = await ai.run('Round1_Storage', async () => {
     const args = { pipelineId, round: 'r1', data: output, inputMeta: input };
     const { pipelineId: pId, round = 'r1', data } = args;

     const startedAt = new Date().toISOString();
     try {
       const persistResult = await persistRoundOutput(pId, round, data);
       return {
         ok: true,
         pipelineId: pId,
         round,
         persistResult,
         startedAt,
         finishedAt: new Date().toISOString(),
       };
     } catch (err) {
       console.error(`[r1_ideate:Round1_Storage] persistRoundOutput failed:`, err);
       return {
         ok: false,
         pipelineId: pId,
         round,
         error: String(err),
         startedAt,
         finishedAt: new Date().toISOString(),
       };
     }
   });
   ```

4. **Inside `persistRoundOutput`:**

   * Write full `data` JSON blob → **GCS**

     ```
     gs://ai-blog-bucket/topics/{pipelineId}_r1.json
     ```
   * Update Firestore `/topics/{pipelineId}`:

     ```ts
     {
       updatedAt: new Date().toISOString(),
       rounds: {
         r1: {
           ideaCount: data.ideas?.length ?? 0,
           gcsPath: "gs://ai-blog-bucket/topics/{pipelineId}_r1.json",
           status: "in_review",
         }
       }
     }
     ```

5. **Return Response:**

   ```ts
   {
     pipelineId: string;
     round: 'r1';
     gcsPath: string;
     ideaCount: number;
     ok: boolean;
     finishedAt: string;
   }
   ```

---

## 🧰 Imports Required

The flow will reuse the same core adapters and clients:

```ts
import { ai } from '../clients/genkitInstance.client';
import { persistRoundOutput } from '../adapters/roundStorage.adapter';
import { r1_ideate_input, r1_ideate_output } from '../schemas/flows/r1_ideate.schema';
```

---

## 🧱 Expected Output File

**File:** `flows/r1_ideate.flow.ts`

The module should:

* Define `r1_ideate` as a Genkit flow
* Perform AI ideation
* Run inline `Round1_Storage` subflow using `persistRoundOutput`
* Return the ideation output along with a `__storage` field for traceability

---

## 🧪 Emulator Integration

If running locally:

* The Firebase Emulator Suite will automatically intercept Firestore and GCS operations (via `firebase.emulator.config.ts`).
* GCS paths will remain in `gs://` format for consistency, but point to the local emulator storage.

---

## 💡 Example Flow Usage

```ts
import { r1_ideate } from './flows/r1_ideate.flow';

const result = await r1_ideate({
  pipelineId: 'topic_123',
  topic: 'AI-Powered Marketing',
});

console.log('r1 ideation output:', result);
```

**Result shape:**

```json
{
  "pipelineId": "topic_123",
  "topic": "AI-Powered Marketing",
  "ideas": [
    { "title": "The Future of AI in Ads", "angle": "Predictive Creativity", "summary": "How AI can generate personalized ad campaigns." }
  ],
  "__storage": {
    "ok": true,
    "round": "r1",
    "persistResult": { "firestoreDoc": "topics/topic_123", "gcsPath": "gs://ai-blog-bucket/topics/topic_123_r1.json" }
  }
}
```

---

## 🧩 Notes

* Firestore documents remain unified under `/topics/{pipelineId}`
* GCS artifacts remain segregated by round
* Inline subflow ensures **distinct trace visibility** in Genkit UI
* Reuses **shared adapter logic** — no new storage module required
* Aligns with emulator, production, and orchestrator compatibility

---

## ✅ Deliverable

Generate a complete TypeScript file:
`flows/r1_ideate.flow.ts`
…that follows this `.md` specification precisely and mirrors the same inline subflow pattern used in `r0_trends`.
