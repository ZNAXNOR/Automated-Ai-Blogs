# 🧩 Round 3 — Draft Generation (with Context)

### **Purpose**

Round 3 converts the structured outline and validated research from **Round 2** into a full, human-quality draft — while preserving factual grounding and the intended blog structure through a shared **Genkit Flow Context**.

---

## **Contextual Design**

### **1️⃣ Flow Context (Guardrail Layer)**

Before any subflow begins, the entire `r2_angle` output is registered as **context**, accessible throughout the chain.

```ts
ai.defineFlowContext({
  name: 'r3_draft_context',
  source: 'r2_angle_output',
  description: 'Provides global outline and validated research for all draft subflows.',
});
```

#### **Why This Matters**

* 🧭 Maintains narrative continuity between all sections
* 🧩 Ensures subflows can reference the same research pool
* 🧠 Prevents factual drift or duplication
* 🔒 Enforces alignment with the validated angle from r2

Each subflow and the final flow can then *read* this context automatically — similar to how professionals use a **memory or state layer** in agentic pipelines.

---

## **Architecture**

### **1️⃣ Subflow: Section Draft Generation**

Each section (from the `outline.sections[]`) is handled by a dedicated subflow.

Each subflow:

* Receives its **heading**, **bullets**, and **estWords**.
* Accesses the **r3_draft_context** (includes the full outline + research notes).
* Writes a coherent section respecting its word limit and logical tone.

**Subflow Output**

```json
{
  "sectionId": "s2",
  "heading": "RecurPost: An Overview",
  "content": "RecurPost simplifies the way businesses handle their social media presence..."
}
```

---

### **2️⃣ Main Flow: Assembly + Reasoning**

The **r3_draft flow** orchestrates all section subflows, using the `r3_draft_context` as guardrail for:

* Style and tone consistency
* Logical sequence adherence
* Correct usage of research insights

It merges all sections and adds:

* Title and subtitle
* Reading time
* Short SEO-ready description
* Full continuous draft

---

## **Tooling**

### **For MVP**

* ❌ No external search tools
* ✅ AI only
* ✅ Shared Genkit Flow Context (key new feature)

Later, `googleSearchTool` and `urlContextTool` can plug into each section subflow without altering architecture — the context layer will still manage coherence.

---

## **Flow Data Model**

### **Flow Context (`r3_draft_context`)**

```ts
{
  "researchNotes": [
    { "url": "...", "title": "...", "summary": "..." }
  ],
  "outline": {
    "title": "...",
    "sections": [
      { "id": "s1", "heading": "...", "bullets": [...], "estWords": 120 }
    ]
  }
}
```

### **Flow Output**

```json
{
  "title": "Streamlining Social Media Management: A Guide to RecurPost",
  "subtitle": "How automation transforms modern marketing",
  "sections": [
    { "id": "s1", "heading": "Introduction", "content": "..." },
    { "id": "s2", "heading": "RecurPost: An Overview", "content": "..." }
  ],
  "description": "Discover how RecurPost simplifies social media management through automation and AI-driven scheduling.",
  "readingTime": "6 min",
  "fullDraft": "Managing multiple social media accounts can quickly become overwhelming..."
}
```

---

## **AI Prompting Layers**

### **Subflow Prompt**

> **SYSTEM:** You are a professional blog writer using structured research to create clear, engaging sections.
>
> **INPUT:** Section data (heading, bullets, estWords)
> **CONTEXT:** Full outline and research notes (r3_draft_context)
>
> **TASK:**
>
> * Write a cohesive section in natural tone
> * Use research notes if relevant
> * Respect section focus and flow order
>
> **OUTPUT:** JSON containing sectionId, heading, and paragraph content.

---

### **Main Flow Prompt**

> **SYSTEM:** You are an editor compiling all sections into a unified article.
>
> **CONTEXT:** Global research and outline (r3_draft_context)
> **TASK:**
>
> * Merge all section drafts
> * Ensure smooth transitions
> * Add title, subtitle, SEO description, reading time
> * Maintain stylistic consistency and logical flow

---

## **Expected Benefits**

| Feature                 | Impact                              |
| ----------------------- | ----------------------------------- |
| Flow Context Guardrail  | Prevents factual drift              |
| Modular Subflows        | Easier testing & debugging          |
| Research Integration    | Natural citation and topic fidelity |
| Extensible Architecture | Tool-ready without refactor         |
