# Veralith Dashboard — Design Brief

Self-contained brief for whoever designs the Veralith dashboard UI.
Hand this entire file to your design agent / designer / Claude instance —
it has everything they need to design without prior context on the project.

---

## 1. What Veralith is (in one paragraph)

Veralith is a Python library that diagnoses hallucinations in RAG
(Retrieval-Augmented Generation) systems. A user adds a single decorator
(`@veralith.trace`) to their RAG function. Every call to that function gets
captured as a "trace" — a `(query, context, response)` triple — and
evaluated against three LLM-as-judge metrics:

- **Sufficiency** — Was the retrieval enough to answer each part of the query?
- **Faithfulness** — Is each claim in the response grounded in the retrieved context?
- **Completeness** — Does the response address every part of the query?

The combination collapses into one of six self-describing **failure cells**
(`complete_grounded`, `complete_ungrounded`, `incomplete_grounded`,
`incomplete_ungrounded`, `extra_grounded`, `extra_ungrounded`). Each cell
maps to a remediation suggestion telling the user how to fix that class of
failure (lower generator temperature, improve retrieval, etc.).

All of this happens **asynchronously in a background thread** — the user's
RAG endpoint doesn't slow down. Verdicts land in a local SQLite file
(`veralith.db`).

The dashboard's job is to **make those verdicts visible**.

---

## 2. The product promise the dashboard must fulfill

> *"Add one decorator to your RAG function. Keep this tab open. As your users
> ask questions, you see exactly what your RAG is doing — what failed, why
> it failed, and how to fix it — without ever refreshing."*

That promise breaks down into three things the dashboard MUST do:

1. **Live updates.** New traces appear at the top of the list within a few
   seconds of being evaluated. No manual refresh, no full-page reload.
2. **Diagnosis-first UI.** The thing a user wants to know about a trace is
   *what cell did it land in, and what should I do about it?* — not the raw
   judge outputs. Surface the cell + suggestion prominently; let users drill
   into the details only if they want.
3. **Trustworthy depth.** When users do drill in, they should be able to see
   *why* the judge ruled the way it did — the per-claim reasoning, the
   chunks that grounded each claim, the sub-questions that weren't covered.
   Every verdict should be auditable.

---

## 3. Main user flows

### Flow A — "The casual check-in" (most common)

A developer is shipping a RAG feature. They added the decorator to their RAG
function this morning. Every now and then they switch to the Veralith
dashboard tab. They expect to see:

- A list of recent traces, newest first
- For each trace: the query (truncated), the failure cell as a colored
  chip, a timestamp, maybe key fractions
- One trace at the top is highlighted — it just appeared (live update)
- A high-level "is everything OK?" indicator — most traces healthy?

### Flow B — "Something's broken, drill in"

The developer sees a red `complete_ungrounded` cell on a trace. They click
it. They want to see:

- The query they were asked
- The retrieved chunks (with similarity scores, sources)
- The generated response
- Which **specific claim** in the response is ungrounded, highlighted (red)
- The judge's reasoning for that claim
- Which **other claims** are healthy, also highlighted (green) for contrast
- The **suggestion** — what to do about this kind of failure
- A copy button for the suggestion's action items (paste into their
  notebook / Linear / wherever they triage)

### Flow C — "How's the system doing overall"

A weekly review. The developer wants:

- A failure-cell distribution (how many `healthy` vs each failure type)
- A trend over time — is the system getting better or worse?
- A few "worst traces" surfaced — biggest cost, longest latency, most
  unusual failure cells
- The current calibration state — what's the learned Sufficiency threshold,
  how many traces went into the calculation

This is a less common flow than A or B, but worth designing for since it's
where the dashboard becomes valuable as a recurring tool.

---

## 4. Core views to design

### 4.1 Trace List (the home view)

The default landing screen. Most-used view by far.

**Required elements per trace row:**
- The query (truncated to ~80 chars, full text on hover or click)
- The failure cell (colored chip — see color scheme below)
- Sufficiency fraction (e.g. "S: 100%")
- Faithfulness fraction (e.g. "F: 80%")
- A timestamp (relative: "2m ago", "1h ago", absolute on hover)
- Cost (optional; ~$0.005 per trace — useful aggregate)
- A click-through to the detail view

**Live update behavior:**
- A new row slides in at the top with a subtle highlight that fades over
  ~2 seconds. Don't disrupt the user's scroll position.
- A small "live" indicator somewhere (pulsing dot? "Live" badge?) confirms
  the connection is healthy.
- If the connection drops, a passive banner appears ("Reconnecting…") —
  don't take over the screen with errors.

**Filtering / search (Phase 1 minimum):**
- Filter by failure cell (toggle which cells to show)
- Filter by time range (last hour / 24h / 7d / all)
- (Phase 2) Filter by source/project/tag if multi-project lands
- (Phase 2) Free-text search on the query

### 4.2 Trace Detail (the diagnosis view)

When a user clicks a trace, they get a full-page or side-panel view of one
trace's evaluation.

**Layout suggestion (top to bottom):**

1. **Diagnosis banner** — the most prominent element
   - The failure cell name in large type, color-coded
   - The suggestion title (e.g. "Retrieval gap" / "Generator hallucinated despite good retrieval")
   - 2-3 sentence suggestion body
   - Action list (bulleted) with concrete steps
   - Sufficiency level (HIGH/LOW) + numeric fractions for both S and F

2. **Q / R side-by-side** (or stacked on narrow screens)
   - The query, full text
   - The response, full text — with **inline highlighting** on each claim:
     - Green highlight for grounded claims
     - Red highlight for ungrounded claims
     - Tooltip / hover on each highlight reveals the judge's reasoning for that claim

3. **Retrieved context (collapsible)**
   - List of chunks (rank, source, similarity score, full text)
   - Each chunk is clickable to "show which claims this grounded"
   - The chunk preview can be truncated by default, expand on click

4. **Sub-questions panel**
   - Each sub-question (Qi) as a row
   - A pass/fail indicator (Sufficiency verdict)
   - The judge's reasoning
   - "Supporting chunks: #0, #2" (clickable refs to the chunk list above)
   - For missing Qi (Completeness incomplete), show as red "not covered"

5. **Per-claim breakdown** (the data behind the inline highlighting)
   - Each claim (Ri) with its verdict, reasoning, grounding chunks
   - For ungrounded claims, this is the smoking gun — show the judge's
     reasoning clearly

6. **Latency + cost metadata** (footer, small)
   - Phase latencies (decompose, judge sufficiency, judge faithfulness, etc.)
   - Tokens used / cost in USD

### 4.3 Stats / Overview

A separate page (or top section of the home view) showing aggregate health.

**Suggested charts:**

1. **Failure cell distribution** — a stacked bar or donut chart showing
   counts per cell. Same color coding as the trace list.
2. **Trace volume over time** — simple line chart, last 24h / 7d.
3. **Sufficiency vs Faithfulness fractions over time** — two lines, average
   per hour or day. A divergence between them is a useful signal.
4. **Top failing query patterns** — table of the queries with the highest
   failure rate, grouped by similar text (Phase 2 if hard).

### 4.4 Calibration Panel

A small section, probably in a settings sidebar or its own page.

**Show:**
- Current learned Sufficiency threshold (e.g. "0.85")
- How many successful traces contributed (e.g. "127 of 240 total")
- Whether we're using the fallback (1.0) or the learned value
- A button to "force recalibration" (Phase 2)

### 4.5 Live Status Indicator

Anywhere in the chrome — a small element that shows:
- "Connected" (green dot) — SSE/polling is alive
- "Reconnecting" (amber pulse) — transient disconnect
- "Disconnected" (red, with timestamp of last good connection)
- Optional: "N evaluations queued" — workers behind, traces coming soon

---

## 5. API endpoints to design against

These are the endpoints the FastAPI backend will expose. The dashboard
frontend talks to these. Some don't exist yet (this is the design target
the backend team will build to).

All responses are JSON unless noted. All endpoints are under `/api/`.

### `GET /api/traces`

List traces, newest first, paginated.

**Query params:**
- `limit` (int, default 50)
- `offset` (int, default 0)
- `cells` (comma-separated cell names — filter to just these)
- `since` (ISO timestamp — only traces newer than this)

**Response:**
```json
{
  "traces": [
    {
      "id": 42,
      "query": "What is the Rule of 72?",
      "response_preview": "The Rule of 72 is a mental shortcut...",
      "failure_cell": "complete_grounded",
      "sufficiency_fraction": 1.0,
      "faithfulness_fraction": 1.0,
      "n_sub_questions": 1,
      "n_claims": 5,
      "created_at": "2026-05-22T14:32:01Z",
      "latency_ms_total": 8245.3,
      "cost_usd": 0.0048
    },
    ...
  ],
  "total": 1247,
  "has_more": true
}
```

### `GET /api/traces/{id}`

Full detail of a single trace.

**Response:**
```json
{
  "id": 42,
  "query": "What is the Rule of 72?",
  "response": "The Rule of 72 is a mental shortcut...",
  "created_at": "2026-05-22T14:32:01Z",
  "context_chunks": [
    {
      "rank": 0,
      "source": "compound_interest.md",
      "score": 0.612,
      "text": "..."
    }
  ],
  "sub_questions": [
    {
      "id": 1, "order_idx": 0,
      "text": "What is the Rule of 72?",
      "sufficiency": {
        "verdict": "Y",
        "reasoning": "Directly defined in chunk 0.",
        "supporting_chunk_ranks": [0]
      }
    }
  ],
  "claims": [
    {
      "id": 1, "order_idx": 0,
      "text": "The Rule of 72 is a mental shortcut.",
      "faithfulness": {
        "verdict": "Y",
        "reasoning": "Stated verbatim in chunk 0.",
        "grounding_chunk_ranks": [0]
      }
    }
  ],
  "completeness": {
    "overall": "complete",
    "reasoning": "Q0 fully covered by claims R0-R4.",
    "mappings": [
      {"sub_question_id": 1, "covered_by_claim_id": 1}
    ],
    "extra_claim_ids": []
  },
  "diagnosis": {
    "failure_cell": "complete_grounded",
    "sufficiency_level": "high",
    "sufficiency_fraction": 1.0,
    "faithfulness_fraction": 1.0,
    "n_sub_questions": 1,
    "n_claims": 5,
    "n_uncovered_sub_questions": 0,
    "n_extra_claims": 0
  },
  "suggestion": {
    "title": "Healthy trace",
    "body": "Retrieval surfaced enough context, the generator answered every sub-question, and every claim is grounded in the retrieved chunks. No action needed.",
    "actions": []
  },
  "latency_ms": {
    "persist_trace": 5.7,
    "decompose_query": 1842.3,
    "decompose_response": 1923.5,
    "judge_sufficiency": 1411.8,
    "judge_faithfulness": 1872.9,
    "judge_completeness": 1654.0
  },
  "errors": {}
}
```

### `GET /api/stats`

Aggregate stats for the overview view.

**Query params:**
- `since` (ISO timestamp, default last 7 days)

**Response:**
```json
{
  "total_traces": 1247,
  "by_cell": {
    "complete_grounded": 1083,
    "complete_ungrounded": 24,
    "incomplete_grounded": 87,
    "incomplete_ungrounded": 5,
    "extra_grounded": 41,
    "extra_ungrounded": 7
  },
  "avg_sufficiency": 0.94,
  "avg_faithfulness": 0.97,
  "total_cost_usd": 6.23,
  "timeseries": [
    {"bucket": "2026-05-22T00:00:00Z", "count": 156, "avg_sufficiency": 0.93, "avg_faithfulness": 0.96},
    {"bucket": "2026-05-22T01:00:00Z", "count": 142, "avg_sufficiency": 0.95, "avg_faithfulness": 0.97}
  ]
}
```

### `GET /api/calibration`

Current calibration state.

**Response:**
```json
{
  "threshold": 0.85,
  "n_successful_traces": 127,
  "percentile": 10,
  "using_fallback": false,
  "fallback_value": 1.0
}
```

### `GET /api/events` (Server-Sent Events stream)

Live updates. The dashboard opens this connection and keeps it open. The
backend pushes events whenever new traces complete evaluation.

**Event types:**
```
event: trace_created
data: {"id": 43, "query": "...", "created_at": "..."}

event: trace_evaluated
data: {"id": 43, "failure_cell": "complete_grounded", "sufficiency_fraction": 1.0, "faithfulness_fraction": 1.0}

event: trace_failed
data: {"id": 43, "errors": {"sufficiency": "rate limit"}}
```

The frontend uses `trace_evaluated` to insert/update the row in the trace
list. `trace_created` is optional (shows a pending row before eval finishes).

### Other endpoints (Phase 2 / nice-to-have)

- `POST /api/queries` — submit a Q/C/R directly via the dashboard for
  ad-hoc testing without writing Python code.
- `GET /api/traces/{id}/raw` — full Pydantic dump if the user wants the
  underlying data.
- `PATCH /api/traces/{id}/flag` — mark a trace as a false positive (we
  later use this signal to retune judge prompts).
- `GET /api/projects` — multi-project listing (only relevant after the
  hosted multi-tenant version).

---

## 6. The failure cell taxonomy (for color coding and UI copy)

Six cells, each with a meaning and a suggested visual treatment.

| Cell | Means | Severity | Suggested color |
|---|---|---|---|
| `complete_grounded` | Healthy. Answer covers everything; every claim grounded. | None | Green |
| `complete_ungrounded` | Hallucinated. Answer covers everything but some facts are invented. | High | Red |
| `incomplete_grounded` | Missed parts of the query, but what's there is grounded. Often a retrieval gap. | Medium | Amber / orange |
| `incomplete_ungrounded` | Missed parts AND fabricated within what was answered. Worst-case. | Critical | Deep red |
| `extra_grounded` | Padded answer — added unrequested content, all grounded. Mild concern. | Low | Yellow |
| `extra_ungrounded` | Padded AND fabricated. Off-topic invention. | High | Red |

Reading pattern: the cell name decodes as `<completeness>_<faithfulness>`.
A reader who sees a cell name they haven't seen before can read it as
*"the response is `<X>` and the claims are `<Y>`"*.

---

## 7. Visual / interaction design notes

### What should be loud

- **The failure cell** on every trace row. The user's eye should go there first.
- **The suggestion** in the trace detail view. It's the most actionable piece
  of information on the page.
- **Live-update arrival animations** (briefly). New = noticed.

### What should be quiet

- **Healthy traces** should look healthy and be easy to skip. They're the
  majority. Don't shout about them.
- **Phase latencies and cost** are footer-grade metadata. Useful but not
  primary.
- **Calibration state** is a small sidebar widget, not a main view.

### Live update behavior in detail

- The connection (SSE or polling) is established when the dashboard loads
  and persists for the session.
- When `trace_evaluated` arrives, the row is inserted at the top of the
  list (assuming default sort) with a 1-second highlight glow that fades.
- Scroll position is preserved — don't auto-scroll to the new row.
- If the user has filters applied that the new trace doesn't match, the
  row doesn't appear (but a small "1 trace hidden by filter" notification
  could show).
- Reconnect logic: exponential backoff, max 30 sec between retries. UI
  shows "reconnecting" status during retries.

### Empty states

- **No traces yet** — first-time experience. Show install instructions
  ("`pip install veralith`") and the decorator example. Auto-detect when
  the first trace arrives and switch to the populated view.
- **No traces match filter** — show "no traces match these filters" with
  a "clear filters" button.
- **Worker errors** — if the SDK's worker is failing, show a banner
  ("Evaluations failing — check OPENAI_API_KEY?").

### Mobile / narrow screens

Not a primary use case. The dashboard is a developer tool used on laptops.
But the trace list should at least be scrollable on phones for the case
of someone checking on the go. Trace detail can be desktop-only.

---

## 8. What's Phase 1 (MVP) vs Phase 2

Design for Phase 1 first. Phase 2 can be sketched on the side.

### Phase 1 (must ship for the dashboard to be "complete")

- Trace list with live updates
- Trace detail view with diagnosis, suggestion, Q/R, chunks, sub-questions, claims
- Per-claim grounding highlighting in the response
- Failure cell color coding throughout
- Basic filtering (by cell, by time range)
- Calibration widget
- Connection-status indicator

### Phase 2 (nice but later)

- Stats overview with charts
- Free-text search on queries
- Submit ad-hoc Q/C/R from the dashboard
- "Flag as false positive" / feedback loop
- Top failing query patterns / clustering
- Multi-project switcher
- Export traces to JSONL

### Out of scope (don't design)

- Authentication / user accounts (single-tenant for now)
- Custom dashboards / dashboards-as-code
- Integration with external observability tools (Sentry, Datadog)
- Prompt editing / running the user's RAG from the dashboard

---

## 9. Brand / tone

Veralith is:
- **Diagnostic, not punitive.** The dashboard isn't a "you screwed up"
  display — it's a "here's what happened and how to fix it" display.
- **Honest about uncertainty.** When the judge is unsure or fails, the UI
  should say so rather than pretending the verdict is definitive.
- **Developer-facing.** Aimed at engineers, not executives. Density and
  precision over hand-holding.
- **Calm by default, loud where it matters.** Healthy traces should fade
  into the background; failures stand out.

Tagline candidates (for the header / about):
- *"Hallucination triage for RAG pipelines — one decorator, every failure
  named, every fix spelled out."*
- *"Veralith does for RAG what tracebacks did for exceptions."*

---

## 10. Reference: the data primitives in code

For accuracy when designing forms / queries / responses, here are the
core Pydantic models the backend will serialize. They live in
`veralith/schemas.py`.

```python
class FailureCell(str, Enum):
    COMPLETE_GROUNDED       = "complete_grounded"
    COMPLETE_UNGROUNDED     = "complete_ungrounded"
    INCOMPLETE_GROUNDED     = "incomplete_grounded"
    INCOMPLETE_UNGROUNDED   = "incomplete_ungrounded"
    EXTRA_GROUNDED          = "extra_grounded"
    EXTRA_UNGROUNDED        = "extra_ungrounded"


class SufficiencyLevel(str, Enum):
    HIGH = "high"
    LOW  = "low"


class Diagnosis(BaseModel):
    failure_cell:                 FailureCell
    sufficiency_level:            SufficiencyLevel
    sufficiency_fraction:         float    # 0.0 - 1.0
    faithfulness_fraction:        float    # 0.0 - 1.0
    n_sub_questions:              int
    n_claims:                     int
    n_uncovered_sub_questions:    int
    n_extra_claims:               int


class Suggestion(BaseModel):
    title:           str
    body:            str
    actions:         list[str]
    detailed_body:   Optional[str]    # Phase 2: LLM-enriched per-trace specifics
    pattern_insights: list[str]        # Phase 2: cross-trace findings


class SufficiencyJudgment(BaseModel):
    sub_question_id:         int
    verdict:                 "Y" | "N"
    reasoning:               str
    supporting_chunk_ranks:  list[int]


class FaithfulnessJudgment(BaseModel):
    claim_id:                int
    verdict:                 "Y" | "N"
    reasoning:               str
    grounding_chunk_ranks:   list[int]


class CompletenessJudgment(BaseModel):
    overall:                  "complete" | "incomplete" | "extra"
    mappings:                 list[CompletenessMapping]  # per-Qi → which Ri covers it
    extra_claim_ids:          list[int]
    reasoning:                str
```

---

## 11. Useful "first impression" mockups to design

If you only design five screens, design these:

1. **First-load empty state** — user just installed the library, no traces
   yet. Should teach them how to integrate and what to expect.
2. **Populated trace list with one new arrival** — the everyday state.
3. **Trace detail for a healthy trace** — happy path, mostly green.
4. **Trace detail for an `incomplete_ungrounded` trace** — worst-case, red
   everywhere, suggestion prominent. Should make a viewer immediately
   understand what failed and what to do.
5. **Connection lost banner** — the failure-mode design that proves the UI
   is honest about uncertainty.

That's the brief. Build for these and the rest of the views fall into place.
