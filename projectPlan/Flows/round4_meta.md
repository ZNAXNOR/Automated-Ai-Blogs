## 🧠 r4_meta — Metadata & SEO Enrichment Flow

**Purpose:**
Generate complete blog metadata and SEO foundation to optimize visibility, click-through rate, and reader retention before final polish.

---

### 🎯 Primary Objectives

* Create **SEO-friendly metadata** that aligns with the refined draft (from r3).
* Extract and suggest **semantic keywords**, **title**, **slug**, and **SEO description**.
* Provide **AI image prompts** and **contextual media ideas** that can later guide image generation.
* Enhance blog **discoverability** while maintaining authenticity and user focus.

---

### 🧩 Input Schema

**From:** r3_draft
**Input Fields:**

* `blogTitle`: Title from ideation or draft stage.
* `draftText`: The refined draft content from r3.
* `topic` or `angle`: The main theme of the article.
* Optional context such as brand tone or writing style preferences.

---

### 🧾 Output Schema

**Expected Output:**

```json
{
  "title": "string",
  "slug": "string",
  "seoDescription": "string",
  "seoKeywords": ["string"],
  "tags": ["string"],
  "primaryCategory": "string",
  "readingLevel": "Beginner | Intermediate | Expert",
  "featuredImage": {
    "type": "ai_prompt | stock_reference | meme",
    "description": "string",
    "aiPrompt": "string (detailed)",
    "styleGuidance": "string (optional)"
  },
  "additionalImages": [
    {
      "context": "section_title or concept",
      "type": "ai_prompt | stock_reference | meme",
      "description": "string",
      "aiPrompt": "string"
    }
  ]
}
```

---

### 🧱 Workflow Logic

1. **Extract & Analyze Draft**

   * Parse main entities, keywords, and tone.
   * Identify dominant topic and subtopics using TF-IDF or AI summarization.

2. **Generate Metadata**

   * Create **SEO-optimized title** (≤ 60 chars) balancing curiosity and clarity.
   * Create **slug**: lowercase, hyphenated, keyword-rich.
   * Craft **SEO description** (≤ 155 chars) summarizing core message with target keyword.
   * Generate **semantic keyword set** — mix of short-tail, mid-tail, and long-tail terms.

3. **Tagging & Categorization**

   * Assign topic-based tags.
   * Suggest a primary blog category or reading level based on complexity.

4. **Media Suggestions**

   * Identify if image(s) will **add strong contextual or emotional value**.
   * For each selected image:

     * Define `type` (`ai_prompt`, `meme`, or `stock_reference`).
     * For AI prompts: follow brand tone, detailed visual description, complementary color harmony, and artistic freedom leaning toward semi-realistic illustration or 19th-century art style.
     * For memes: ensure search-accurate description; for originals, explain fully with scenario context.
     * For stock references: suggest specific people, companies, or themes, including URLs where possible.

5. **Return Output Object**

   * Combine all fields into structured metadata JSON.
   * Hand off to `r5_polish` for stylistic finalization.

---

### 📈 Professional Workflow Parallels

| Professional Practice                 | Your Implementation Benefit                                         |
| ------------------------------------- | ------------------------------------------------------------------- |
| **SEO & metadata before polish**      | Ensures polish aligns with finalized keywords and reader intent.    |
| **AI & meme asset guidance**          | Maintains creativity while standardizing quality and searchability. |
| **One featured image rule**           | Reduces noise and maintains design consistency.                     |
| **Data-ready JSON schema**            | Streamlines integration with Firestore or CMS.                      |
| **Automatic title & slug refinement** | Keeps human edits minimal in post-production.                       |

---

### ⚙️ Firestore Integration (Future)

Will store:

* `title`, `slug`, `seoDescription`, `seoKeywords`, and `tags` in `metadata` collection.
* Reference `draftId` from previous flow.
* Optional link to generated images or image prompts for automation in later versions.

---

### 🧩 Next Step in Pipeline

→ `r5_polish`: Final stylistic enhancement of the draft based on `r4_meta` output — aligning narrative with SEO and metadata insights.
