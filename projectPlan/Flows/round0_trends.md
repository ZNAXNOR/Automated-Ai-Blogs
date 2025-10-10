# 📘 **r0_trends.flow.md**

### **Purpose**

`r0_trends` is the **first flow** (`r0`) in the blog generation pipeline.
Its role is to **seed initial topic candidates** that will later be refined and expanded by subsequent flows (`r1` → `r5`).

This flow focuses on **discovering currently trending topics** using one or more trend-data APIs — starting with **Google Trends (via SerpAPI)**.

---

### **Flow Summary**

| Property                  | Description                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flow Name**             | `r0_trends`                                                                                                                                  |
| **Primary Function**      | Fetches trending keywords & timelines for a given base topic.                                                                                |
| **Stage Role**            | Acts as the *ideation seed generator* — converts broad base categories (like “Data Analytics”) into a list of fresh, trend-driven subtopics. |
| **Output Feeds Into**     | `r1_context` or other refinement rounds.                                                                                                     |
| **Implementation Type**   | Pure **Genkit flow** — no retrievers/indexers; all logic and API calls.                                                                      |
| **External Dependencies** | `SerpAPI` (Google Trends endpoint).                                                                                                          |

---

### **Flow Structure**

```mermaid
            ┌───────────────────────────┐
            │  Input: r0_trends_input   │
            └─────────────┬─────────────┘
                          │
                          ▼
            ┌───────────────────────────┐
            │  Call SerpAPI to fetch    │
            │   Google Trends data      │
            └────────┬─────────┬────────┘
                     │         │
                     ▼         ▼
      ┌───────────────────┐  ┌─────────────────────┐
      │ Extract rising    │  │ Extract trend       │
      │ related queries   │  │ timeline data       │
      └─────────┬─────────┘  └──────────┬──────────┘
                │                       │
                └───────────┬───────────┘
                            ▼
               ┌──────────────────────────┐
               │  Combine extracted data  │
               └─────────────┬────────────┘
                             │
                             ▼
              ┌────────────────────────────┐
              │  Output: r0_trends_output  │
              └────────────────────────────┘
```

---

### **Input Schema**

| Field          | Type               | Description                                                                     |
| -------------- | ------------------ | ------------------------------------------------------------------------------- |
| `topic`        | Enum (`BlogTopic`) | Base topic category (e.g., “Data Analytics”, “WordPress”).                      |
| `timeframe`    | String (optional)  | Google Trends timeframe (`now 7-d`, `today 12-m`, etc.). Defaults to `now 7-d`. |
| `geo`          | String (optional)  | Geographic region code (`IN`, `US`, etc.). Defaults to `IN`.                    |
| `relatedLimit` | Number (optional)  | How many related queries to keep. Defaults to `5`.                              |

---

### **Output Schema**

| Field           | Type                                     | Description                                         |
| --------------- | ---------------------------------------- | --------------------------------------------------- |
| `baseTopic`     | String                                   | Original topic requested.                           |
| `suggestions`   | Array<{ topic: string; score: number; }> | List of trending queries related to the base topic. |
| `trendTimeline` | Array<{ time: Date; value: number; }>    | Normalized interest-over-time data points.          |

---

### **Flow Logic**

1. **Input validation**

   * Ensures the topic is a valid enum.
   * Fills defaults for `geo`, `timeframe`, and `relatedLimit`.

2. **API key resolution**

   * Retrieves SerpAPI key via Firebase Secret Manager (`defineSecret`).

3. **API Request**

   * Calls `https://serpapi.com/search.json`
     with `engine=google_trends` and parameters:
     `q`, `geo`, `timeframe`, `data_type=RELATED_QUERIES`.

4. **Parsing**

   * Extracts:

     * `related_queries.rising` → list of suggested topics.
     * `interest_over_time.timeline_data` → historical interest values.

5. **Normalization**

   * Converts extracted numeric fields to numbers.
   * Maps timeline entries to `{ time, value }` objects.

6. **Output construction**

   * Returns a standardized JSON containing:

     * `baseTopic`
     * `suggestions`
     * `trendTimeline`

---

### **Caching Pattern (for future use)**

To prevent redundant API calls and rate-limit exhaustion,
a caching layer should be introduced later.

**Recommended pattern:**

1. Before calling SerpAPI:

   * Check Firestore (or Redis) for an entry with the same `topic` + `timeframe` + `geo`.
2. If cached (and < 5 days old), use that data.
3. If not cached:

   * Fetch from SerpAPI.
   * Store `{ request, response, timestamp }` in Firestore under `/trendsCache/`.

Example Firestore structure:

```json
/trendsCache/
  DataAnalytics_now7d_IN: {
    data: {...},
    fetchedAt: "2025-10-09T00:00:00Z"
  }
```

---

### **Error Handling**

* If no related queries or timeline data are found, an error is thrown.
* Logs for all key steps are included (`input`, `fetch`, `parse`, `output`).

---

### **Future Improvements (To-Do List)**

| Area                          | Description                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 🧩 **Multi-topic Batch Mode** | Allow array input of topics (e.g., “AI”, “Marketing”, “WordPress”) and aggregate results.                   |
| 🔄 **Fallback Sources**       | Integrate other APIs: YouTube Trends, GNews, X (Twitter) trends, Reddit Hot Posts, Wikipedia Popular Pages. |
| 🗃️ **Caching Layer**         | Implement Firestore caching and automatic expiry for stale trend data.                                      |
| 🧠 **Duplication Control**    | Track previously used suggestions to prevent repeated content generation.                                   |
| ⚙️ **Ranking Logic**          | Merge scores from multiple APIs for smarter trend weighting.                                                |
| 🌐 **Regional Expansion**     | Include global comparison (e.g., `IN` vs `US`) and normalize interest.                                      |
| 🧾 **Feed Integration**       | Optionally enrich results using RSS, Blogger, or Medium APIs.                                               |
| 🧩 **Retry/Failover System**  | If SerpAPI fails, fallback to cached or alternate API automatically.                                        |

---

#### **Summary**

`r0_trends` establishes the **foundation of the topic generation pipeline** — turning category enums into relevant, trending, and data-driven topic suggestions.
Future rounds (r1–r5) will contextualize, refine, and build content structures from these initial topic candidates.
