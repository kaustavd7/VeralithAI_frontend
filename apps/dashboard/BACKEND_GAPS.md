# Backend gaps — fields and endpoints the new dashboard would like

> Source of truth for follow-up coordination with Dev 1.
> This file lists every API field or behaviour the new Project Overview / Trace
> Explorer designs assume but the v1 contract does NOT yet provide.
> Each gap names the page/component, what we want, why, and the current fallback.

The new design ships strictly against the existing contract — every field on
screen today maps to a field in `planning/Context/dashboard_api_contract.md`.
The items below are deferred enhancements, not blockers.

---

## Project Overview — `/projects/:slug`

### 1. Cost delta over the last 24h

**Want:** `stats.deltas.total_cost_usd_delta_24h` (number, USD delta vs. previous 24h window).

**Why:** The KPI row's Cost card matches the other four KPIs which all show a delta. Today we render Cost as a value-only card (no `↑`/`↓` glyph, no comparison) because the contract has no per-window cost delta.

**Fallback in code:** Cost KPI displays just `$X.XX`. See `routes/ProjectOverview.tsx → buildKpis()`, the trailing entry.

---

### 2. Per-bucket cost in `stats.timeseries`

**Want:** add `cost_usd` to each `stats.timeseries[i]` entry.

**Why:** We'd render a small Cost sparkline next to the value, matching the four other KPIs which use `stats.timeseries[*].count / ok / avg_sufficiency / avg_faithfulness`.

**Fallback:** Cost KPI has no sparkline (the four others do).

---

### 3. Stream uptime / "SDK connected since"

**Want:** an SSE-side metric — when did this project's `/v1/events` stream last (re)connect, or how long has it been continuously up?

Concrete field idea: include a `connected_since` ISO timestamp on the SSE `keepalive` event or expose it as a new endpoint `GET /v1/projects/{id}/connection`.

**Why:** ConnectionCard's "live" state in the design shows `Stream uptime · 12m 04s` so the user knows how long their SDK has been actively pushing traces. Today we cannot tell whether the SDK is connected at all without observing live traces.

**Fallback:** the "Stream uptime" row is omitted in the live-state ConnectionCard.

---

### 4. SDK language + version reported by ingest

**Want:** capture the SDK headers on `POST /v1/traces` (e.g. `User-Agent: veralith-python/0.4.2`) and surface them somewhere — either on the most recent `TraceListItem` or on `stats` (`stats.sdk_last_seen: { lang: "python", version: "0.4.2" }`).

**Why:** ConnectionCard wireframe shows `SDK · python 0.4.2` so the user can confirm which client is producing traces. Useful when a customer upgrades their SDK and we want to confirm the new version is in fact talking to us.

**Fallback:** the "SDK" row is omitted.

---

### 5. Average gap between traces (idle state)

**Want:** `stats.avg_gap_seconds` (or derivable from a histogram of inter-arrival times).

**Why:** ConnectionCard's "idle" state in the wireframe shows `Average gap · 42s` to communicate "yesterday traffic was steady at one trace every 42s; today nothing in 5 minutes." Today we'd have to fetch a deep page of traces and diff timestamps client-side — fragile.

**Fallback:** the "Average gap" row is omitted from the idle-state ConnectionCard.

---

### 6. State derivation (`live` / `idle` / `never`)

**Have today:** derivable from `stats.total_traces === 0` (→ never) and a single-row `listTraces(limit=1)` check on `created_at` (→ live if <5 min, else idle).

**Want (nice-to-have):** a dedicated `stats.connection_state: "live" | "idle" | "never"` and `stats.last_trace_at: string`. Saves two extra round trips and centralises the threshold so backend changes propagate to the UI.

**Fallback in code:** `routes/ProjectOverview.tsx → deriveConnState()` computes this from `useStats` + `useTraces({ limit: 1 })`.

---

## Trace Explorer — `/projects/:slug/traces`

### 7. Free-text search on query / response / claim text

**Want:** a `?q=...` query param on `GET /v1/projects/{id}/traces` that searches across `query`, `response`, and (eventually) `claims[].text`.

**Why:** the wireframe's search box (`Search query, claim, trace id…`) is one of the page's primary affordances for triage.

**Fallback in code:** The search input filters **only the currently loaded page** of `useTraces`. The placeholder reads "Search query or trace id (current page)…" so the limitation is honest. See `routes/TraceExplorer.tsx → rows` memo.

This is the most visible gap to a user. Contract §10 currently lists "Filtering traces by free-text query" as explicitly out of v1 — coordinate with Dev 1 on prioritisation.

---

### 8. Server-side sort by sufficiency / faithfulness / cost / latency

**Want:** extend `?sort=` to include `sufficiency_asc | sufficiency_desc | faithfulness_asc | …`. Today the contract supports only `newest | oldest`.

**Why:** the wireframe's default UX is "sort by sufficiency ascending — worst-first triage" because the whole point of the page is "show me what's failing." Today we send `sort=newest` to the server and do `sort sufficiency_asc` client-side over the page.

**Fallback in code:** `routes/TraceExplorer.tsx` keeps an in-page sort option labelled `sufficiency ↑ (page)` and surfaces in the header sub-line: "client-side over current page." User can change page and re-sort, but it does not span the dataset.

---

### 9. Bulk CSV / JSONL export endpoint

**Want:** `GET /v1/projects/{id}/traces.csv?since=&cells=&…` (same filters as `/traces`) returning a streamed CSV.

**Why:** the wireframe's "Export CSV" button. Today our button exports **only the loaded page** (≤ 25 rows). The button title attribute explains this honestly to the user.

**Fallback in code:** `routes/TraceExplorer.tsx → exportCsv()` serialises the loaded rows to a `Blob` and triggers a download.

---

### 10. Trace count per failure cell, scoped to the active time window

**Today:** `stats.by_cell` is global to the stats window; the contract defaults to last 24h. The CellChips component shows counts on each cell — for the chip count to match what the table shows when the user changes the time window to "7d", we'd need cell counts to honour the same `since` / `until` as the underlying traces query.

**Fallback in code:** Cell chip counts come from `useStats(slug)` which uses the default 24h window. Counts will be off when the user picks 7d / 30d. Cosmetic, not load-bearing — but worth fixing once we can pass `since` through to stats too.

(Possible API addition is trivial: stats already accepts `since` / `until` — we just need to call it with the same window on the explorer page.) **This one might be a frontend fix, not a backend gap.** Flagged here for visibility.

---

## Cross-cutting

### 11. Last-trace timestamp on `Project`

**Want:** add `last_trace_at: string | null` to the `Project` shape returned by `GET /v1/projects`.

**Why:** the projects list page (when it gets the new design) needs to show "last trace · 2m ago" on each card. Without this we'd hit `/v1/projects/{id}/traces?limit=1` per project — O(N) round trips.

**Fallback in code:** not yet exercised — projects list page isn't rebuilt in this pass.

---

### 12. SSE for the Trace Explorer page

**Want:** `trace_evaluated` (already specified in §5.8) wired so the explorer can prepend / re-rank without manual refresh.

**Why:** matches Phase 5 of the original plan.

**Fallback in code:** none yet — table refreshes only when filters change. Phase 5 work.

---

## How to use this report

When you next chat with Dev 1, walk through items 1–9. The ones that materially
change the dashboard:

1. **Items 7 + 8** are the most visible to a user — search and worst-first sort.
2. **Item 9** is needed before we can promise "export your traces" in marketing.
3. **Item 11** unblocks the projects list page's per-card activity line.

Items 3, 4, 5 (Stream uptime / SDK version / average gap) are nice-to-have polish
on the ConnectionCard; the card is fully functional without them today.

Items 1, 2, 6, 10 are tiny additive changes (one or two fields each).

---

## Analytics — `/projects/:slug/analytics`

> Imported from `planning/Context/VeralithAI/API_MISSING_ANALYTICS_ENDPOINTS.md`
> (proposed by Design, 2026-05-30; status: needs Dev 1 review).
> The Analytics dashboard originally planned 6 panels; three have no backing API
> endpoint and have been **removed from the design until those endpoints exist**.
> This section is the spec for those three endpoints so the panels can be
> brought back. Relates to `dashboard_api_contract.md` §5.6.

### Summary

| Panel | What it needs | Current API gap |
|---|---|---|
| Latency percentiles (p50/p95/p99 line chart) | Per-bucket percentile aggregation of `latency_ms_total` | `GET /v1/projects/{id}/stats` has no latency fields |
| Score distributions (sufficiency + faithfulness histograms) | Histogram bin counts for both scores | No histogram/distribution endpoint exists |
| Calibration drift (threshold line over 14 weeks) | Timeseries of calibration threshold | `GET /v1/projects/{id}/calibration` returns only the current single value |

Panels that **do** have API support and ship in the v1 dashboard:

| Panel | API source |
|---|---|
| Trace volume | `stats.timeseries[].count / ok / failed` |
| Failure-cell distribution | `stats.by_cell` |
| Top failing queries | `GET /v1/projects/{id}/traces` (client-side sort by sufficiency ↑ — see also explorer gap #8 above) |

---

### A1. Latency Percentiles

**Recommended:** extend `GET /v1/projects/{id}/stats` (option A — keeps the
dashboard to one stats call per time-window change).

#### New fields (marked with ✦)

```json
{
  "total_traces": 1247,
  "...existing fields...",

  "latency_p50_ms": 910,
  "latency_p95_ms": 2100,
  "latency_p99_ms": 4000,

  "timeseries": [
    {
      "bucket": "2026-05-23T15:00:00Z",
      "...existing fields...",
      "latency_p50_ms": 840,
      "latency_p95_ms": 1950,
      "latency_p99_ms": 3400
    }
  ],

  "deltas": {
    "...existing fields...",
    "latency_p50_delta_pct_24h": 8.0,
    "latency_p95_delta_pct_24h": 5.2,
    "latency_p99_delta_pct_24h": -2.1
  }
}
```

**Alternative (option B):** separate endpoint `GET /v1/projects/{id}/stats/latency`
with `{ summary, timeseries, deltas }` shape. Same SQL.

#### SQL

```sql
SELECT
  date_trunc('hour', created_at) AS bucket,
  count(*)                       AS count,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms_total) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms_total) AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms_total) AS p99_ms
FROM traces
WHERE project_id = $1
  AND status = 'evaluated'
  AND created_at >= $2
  AND created_at < $3
GROUP BY bucket
ORDER BY bucket;
```

**Index:** `CREATE INDEX idx_traces_project_created ON traces (project_id, created_at) WHERE status = 'evaluated';`

#### Edge cases

- Buckets with 0 evaluated traces: omit from timeseries.
- `latency_ms_total` is `NULL` for queued/evaluating traces — the `WHERE status = 'evaluated'` clause handles this.
- Empty window: return `null` for all percentile fields (not `0`).

---

### A2. Score Distributions

The Analytics page needs histogram bin counts for sufficiency and faithfulness
to render twin bar charts.

#### Proposed endpoint

`GET /v1/projects/{id}/stats/distributions`

**Auth:** JWT (owner) or API key (project).

**Query params:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `since` | ISO 8601 | -24h | Window start |
| `until` | ISO 8601 | now | Window end |
| `bin_width` | float | 0.05 | One of: 0.01, 0.05, 0.10, 0.25 |

**Response 200:**

```json
{
  "sufficiency": {
    "bins": [
      { "lower": 0.00, "upper": 0.05, "count": 5 },
      { "lower": 0.05, "upper": 0.10, "count": 4 },
      "...20 bins total for bin_width=0.05..."
    ],
    "mean": 0.94,
    "median": 0.97,
    "sample_size": 1247
  },
  "faithfulness": {
    "bins": [
      "..."
    ],
    "mean": 0.97,
    "median": 0.99,
    "sample_size": 1247
  },
  "threshold": 0.85
}
```

#### SQL

```sql
-- Sufficiency histogram (faithfulness is identical, swap the column)
SELECT
  floor(sufficiency_fraction / $bin_width) * $bin_width AS lower,
  floor(sufficiency_fraction / $bin_width) * $bin_width + $bin_width AS upper,
  count(*) AS count
FROM traces
WHERE project_id = $1
  AND status = 'evaluated'
  AND created_at >= $2
  AND created_at < $3
GROUP BY lower
ORDER BY lower;
```

#### Edge cases

- Scores are 0.0–1.0 inclusive. The bin `[0.95, 1.00)` should be `[0.95, 1.00]` (include 1.0).
- Empty bins: include in response with `count: 0` so the frontend doesn't need to fill gaps.
- `threshold` comes from the existing `/calibration` value — include it here so the frontend can render the dashed threshold line without a second call.

---

### A3. Calibration Drift (Timeseries)

Extend the existing `/calibration` endpoint with a `history` array of ~14 weeks
of weekly snapshots.

#### Updated `GET /v1/projects/{id}/calibration`

**New query params:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `history_since` | ISO 8601 | -14w | How far back to return history |
| `history_bucket` | string | `"week"` | `"day"` \| `"week"` |

**Updated response 200:**

```json
{
  "threshold": 0.85,
  "n_successful_traces": 127,
  "percentile": 10,
  "using_fallback": false,
  "fallback_value": 1.0,
  "computed_at": "2026-05-24T14:00:00Z",

  "history": [
    {
      "bucket": "2026-02-17T00:00:00Z",
      "threshold": 0.82,
      "confidence_lo": 0.78,
      "confidence_hi": 0.86,
      "n_traces": 89,
      "using_fallback": false
    },
    "...14 entries for weekly buckets..."
  ]
}
```

#### Backend requirement

Requires **storing historical calibration snapshots**. Today the calibration is a
single value that gets overwritten by the worker. Two options:

**Option A (recommended): calibration log table**

```sql
CREATE TABLE calibration_history (
  id          bigserial PRIMARY KEY,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  threshold   float NOT NULL,
  percentile  int NOT NULL,
  n_traces    int NOT NULL,
  using_fallback boolean NOT NULL DEFAULT false,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cal_history ON calibration_history (project_id, computed_at);
```

Every time the calibration worker recomputes, it also INSERTs into
`calibration_history`. The existing single-value response stays as-is; `history`
is built from a simple weekly bucket aggregation:

```sql
SELECT
  date_trunc('week', computed_at) AS bucket,
  (array_agg(threshold ORDER BY computed_at DESC))[1]      AS threshold,
  (array_agg(n_traces  ORDER BY computed_at DESC))[1]      AS n_traces,
  (array_agg(using_fallback ORDER BY computed_at DESC))[1] AS using_fallback
FROM calibration_history
WHERE project_id = $1
  AND computed_at >= $2
GROUP BY bucket
ORDER BY bucket;
```

**Option B:** recompute the threshold from raw traces for each historical window
on the fly. Expensive and not recommended for projects with >10k traces.

#### Confidence band

`confidence_lo` / `confidence_hi` are the 95% bootstrap confidence interval. If
this is too complex for v1, omit them and the dashboard will render the line
without the band.

#### Fallback markers

When `using_fallback: true` for a week, the dashboard renders a circled marker
indicating the threshold was the default (not enough data). The per-history
`using_fallback` boolean enables this.

---

### Dashboard wiring (once endpoints ship)

| Panel | Replace | API source |
|---|---|---|
| Latency percentiles | (re-add component to `routes/Analytics.tsx`) | `stats.timeseries[].latency_p50_ms / p95_ms / p99_ms` |
| Score distributions | (re-add component) | `distributions.sufficiency.bins / faithfulness.bins` |
| Calibration drift | (re-add component) | `calibration.history[].threshold / confidence_lo / confidence_hi` |

The original build functions (`buildLatency`, `buildScoreDist`, `buildCalibration`)
and the `LatencyLegend` component live in
`planning/Context/VeralithAI/analytics.jsx` (see `LatencyChart` and friends) —
port them when the endpoints are live.

---

### Priority recommendation

| Endpoint | Complexity | Value | Suggested order |
|---|---|---|---|
| Latency percentiles | Low (single SQL aggregate on existing column) | High — latency is the #1 operational concern | **Ship first** |
| Score distributions | Low (histogram bucketing on existing columns) | Medium — useful for quality audits | Ship second |
| Calibration drift | Medium (requires new table + worker change) | Lower — calibration is stable, rarely checked | Ship last |

### Action items

- [ ] **Dev 1:** Review this section, pick Option A or B for latency, update `dashboard_api_contract.md` with a changelog entry.
- [ ] **Dev 1:** Implement latency percentiles first (lowest effort, highest value).
- [ ] **Dev 1:** Implement score distributions.
- [ ] **Dev 1:** Create `calibration_history` table + update worker to insert snapshots. Implement history query.
- [ ] **Dev 2:** Re-add each panel to the Analytics page as its endpoint ships.
- [ ] **Both:** Agree on whether the confidence band (calibration) is in scope for v1.
