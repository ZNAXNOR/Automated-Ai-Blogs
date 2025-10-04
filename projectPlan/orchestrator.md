# Orchestrator Flow (Genkit / Flow Chain)

## Purpose / Role  
The orchestrator is the central conductor. It initializes a pipeline run, sequences the round flows, handles branching, error recovery, idempotency, and writes status / artifacts to your run store (Firestore or equivalent).  

It ensures consistent chaining of Round 0 → Round 7, allows retries or skipping of rounds if already executed, and aggregates diagnostics and logs.

---

## Flow Structure & Phases

### 1. **Start / Trigger**  
- Entry point: HTTP callable, scheduled trigger, or Firestore doc trigger.  
- Input parameters (seeds, region, brandVoice, etc.) are validated.  
- Create a new `runId` and write initial document in `runs/{runId}` with metadata:
  - `params` (seed, region, voice)  
  - `status: running`  
  - `round: null`  
  - `artifacts: {}`  

### 2. **Round Chaining**  
For each round `i = 0..7`, orchestrator performs:

1. **Check**: Does `runs/{runId}.artifacts.round{i}` already exist?  
   - **If yes**, skip round i (idempotency).  
   - **If no**, execute the flow `round<i>` with proper inputs from prior artifacts or parameters.  
2. **Error handling**: If the round throws an error:
   - Catch and write to `diagnostics` (round, errorMessage, stacktrace)  
   - Mark `runs/{runId}.status = "error"`  
   - Optionally stop execution or continue based on severity.  
3. **Post-round update**: After round returns its output, update `runs/{runId}.artifacts.round{i}` and set `runs/{runId}.round = i`.

You may optionally emit progress events or Pub/Sub signals between rounds (for long-running pipelines or monitoring).

### 3. **Decision Logic / Gate Checks**  
- After Round 6 (coherence & duplication), check `CoherenceReport`.  
  - If coherence below threshold or duplicate flagged, mark run as **“skipped / needs review”**, and optionally abort publishing.  
  - Else, proceed to Round 7.  
- You may branch: for borderline coherence, route to a “human review” subflow instead of direct publish.

### 4. **Completion / End State**  
- On successful Round 7, mark `runs/{runId}.status = "done"`.  
- On failure, status remains `error`.  
- Optionally record total duration, token usage per round, and summary metrics in `runs/{runId}.diagnostics`.  
- Optionally emit a webhook / callback / event so external systems can respond (e.g. notify dashboard, enqueue cleanup).

### 5. **Compensation / Rollback (Optional)**  
- If publishing failed but earlier rounds succeeded, you may queue a retry of Round 7 only.  
- In certain failures, you may want to “revoke” partial side-effects (e.g. delete a draft on WP). Design compensation logic if needed.

---

## Ideal Data Transformation Path

1. **Input param** → seeds, region, brand voice  
2. **Round 0**: TrendItem[]  
3. **Round 1**: TopicIdea[]  
4. **Round 2**: Outline  
5. **Round 3**: SectionDraft[]  
6. **Round 4**: PolishedSection[]  
7. **Round 5**: Metadata + image prompts  
8. **Round 6**: CoherenceReport  
9. **Round 7**: WordPress post creation, return `wpPostId`, `link`

At the end, `runs/{runId}.artifacts` should include keys:  
`round0, round1, …, round7` (unless some skipped)  
Plus `diagnostics` array of per-round timings, token usage, errors.

---

## Additional Considerations & Best Practices

- **Idempotence**: Running the pipeline multiple times should not duplicate posts or re-run already completed rounds. Use existence checks in artifacts.  
- **Timeouts & Long Tasks**: If some rounds (e.g. drafting or embedding) are heavy, consider splitting into subflows or using asynchronous invocation (Pub/Sub) rather than synchronous chaining.  
- **Partial retries**: If one round fails transiently (API error), allow retry that round without re-executing earlier rounds.  
- **Observability**: Emit structured logs on entry, exit, error, with runId, round index, duration (ms), and optionally token usage or API usage.  
- **Monitoring / Alerting**: Watch for runs stuck in a given round, failures, high latency.  
- **Versioning**: Add a `pipelineVersion` field in run metadata; allow older runs to be reprocessed under new logic.  
- **Dry-run / preview mode**: Support a “dry-run” parameter where Round 7 only returns assembled HTML without posting to WP.  
- **Manual override / edit steps**: Possibly inject a “human review” pause before Round 7, especially in early stage or low-coherence cases.  
- **Error escalation**: Decide whether some minor round failures (e.g. missing image prompts) should block publish or be fallbacked.  
- **Delete orphan artifacts**: Over time, prune old `runs` and associated `vectors` or caches.

---

Use this orchestrator manifest as the “roadmap” for your Genkit flow file. When something goes wrong, you can ask: *at which round did artifact get missing / malformed?* or *did status transition skip?*. Linking logs back to runId + round makes debugging easier.
