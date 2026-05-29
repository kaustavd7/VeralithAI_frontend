# Veralith API Contract — v1

**Status:** FROZEN. Changes go through PR review.
**Owners:** Dev 1 (backend implementation), Dev 2 (frontend consumption).
**Base URL:** `https://api.veralithai.com` (production), `http://localhost:8000` (dev).
**API version:** `v1` — all paths begin with `/v1/`.

This contract is the single source of truth shared by:
- The FastAPI backend (`veralithai-backend` — Dev 1)
- The React dashboard (`veralithai-frontend` — Dev 2)
- The Python library's remote transport (`veralith` 0.2.0 — Dev 1)

Any field shape change MUST update this doc first, then ripple through both
codebases. Do not let docs drift behind code.

---

## 1. Conventions

### Transport
- **HTTPS only** in production.
- `Content-Type: application/json` on every request/response with a body.
- All timestamps are **ISO 8601 with timezone** (e.g. `"2026-05-24T14:32:01Z"`).
- All durations are in **milliseconds** unless field name says otherwise.
- All monetary values are in **USD** as decimal strings or floats; field name ends in `_usd`.
- Field names: `snake_case`. Enum values: also `snake_case`.

### Pagination
- Endpoints that list items accept `?limit=N&offset=M` query params.
- Defaults: `limit=50`, `offset=0`. Max `limit=200`.
- Response includes `total` (server count after filters) and `has_more` (boolean).

### Headers
- `Authorization: Bearer <token>` — required on every authenticated endpoint
  (see Section 2 for the two token types).
- `Idempotency-Key: <uuid>` — optional, supported on `POST /v1/traces`.
  Retrying with the same key returns the original response without re-creating.

### IDs
- Project IDs: UUID strings (e.g. `"3f2c0e3a-..."`).
- Trace IDs: 64-bit signed integers (bigserial in Postgres).
- API key IDs: UUIDs. The secret itself is a `vk_live_...` string.

---

## 2. Authentication

The API accepts **two credential types**, both via the same `Authorization: Bearer ...` header. The auth middleware distinguishes by prefix and resolves to the same internal "principal."

### 2.1. Supabase JWT — used by the dashboard (browser)

- Issued by Supabase Auth on sign-in.
- Frontend obtains via `supabase.auth.getSession()` and attaches:
  ```
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...
  ```
- Scoped to one user. User may access any project they own.
- Token lifetime: 1 hour. Frontend should refresh proactively via Supabase client.

### 2.2. Veralith API Key — used by the library (server-to-server)

- Format: `vk_live_<32-char-base62-secret>` (e.g. `vk_live_AbC123xYz...`).
- Issued by `POST /v1/projects/{id}/api-keys`. The full secret is returned **only once**, at creation. Backend stores `sha256(key)` only.
- Attached identically:
  ```
  Authorization: Bearer vk_live_AbC123xYz...
  ```
- Scoped to ONE project. Attempting to access a different project's data returns `403`.

### 2.3. Auth resolution rules

The middleware does:
1. Read `Authorization` header.
2. If token starts with `vk_live_`: hash it, look up in `api_keys` table, resolve to `{ project_id, api_key_id }`. If not found or `revoked_at IS NOT NULL`: `401`. Update `last_used_at`.
3. Else (assumed JWT): verify the signature against Supabase's JWKS, extract `user_id`. Resolve to `{ user_id }`.
4. Attach the principal to the request context. Each endpoint enforces its own project-membership check.

### 2.4. Endpoint matrix — what each token type can do

| Endpoint | JWT (browser) | API key (library) |
|---|---|---|
| `POST /v1/traces` | ❌ 401 — ingest is library-only | ✅ scoped to key's project |
| `GET /v1/projects` | ✅ list user's projects | ❌ 403 — keys see one project only |
| `POST /v1/projects` | ✅ | ❌ |
| `DELETE /v1/projects/{id}` | ✅ if user owns | ❌ |
| `GET /v1/projects/{id}/...` | ✅ if user owns | ✅ if `{id}` matches key's project |
| `GET /v1/projects/{id}/events` (SSE) | ✅ if user owns | ✅ if `{id}` matches key's project |
| `POST /v1/projects/{id}/api-keys` | ✅ if user owns | ❌ |
| `DELETE /v1/projects/{id}/api-keys/{key_id}` | ✅ if user owns | ❌ |

The asymmetry on ingest is deliberate: the browser never POSTs traces; the
library never browses someone else's projects.

---

## 3. Error envelope

Every non-2xx response has this exact shape:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Project has used 200 of 200 evaluations this month.",
    "details": {
      "traces_used": 200,
      "traces_limit": 200,
      "resets_at": "2026-06-01T00:00:00Z"
    }
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `error.code` | string, `snake_case` | Stable identifier; safe for clients to switch on |
| `error.message` | string | Human-readable, English, may be shown directly in UI |
| `error.details` | object, optional | Context-specific structured payload |

### Standard error codes

| HTTP status | `error.code` | When |
|---|---|---|
| 400 | `validation_error` | Request body fails schema validation |
| 400 | `invalid_input` | Logically invalid input (e.g. empty context array) |
| 401 | `unauthenticated` | Missing or invalid `Authorization` header |
| 401 | `token_expired` | JWT is past `exp` |
| 403 | `forbidden` | Authenticated but not allowed to access this resource |
| 404 | `not_found` | Project / trace / api_key doesn't exist or isn't accessible to you |
| 409 | `conflict` | Resource already exists (e.g. project slug taken) |
| 422 | `unprocessable_entity` | Request shape OK but semantically wrong |
| 429 | `rate_limit_exceeded` | Free-tier monthly cap hit |
| 500 | `internal_error` | Unexpected backend failure; include `error.details.request_id` |
| 502 | `upstream_error` | OpenAI / Supabase / other dependency failed |
| 503 | `service_unavailable` | Backend in maintenance |

---

## 4. Type definitions

These types are reused across multiple endpoints. Mirror them verbatim into
`frontend/dashboard/src/api/types.ts`.

### 4.1. Enums

```ts
export type FailureCell =
  | "complete_grounded"
  | "complete_ungrounded"
  | "incomplete_grounded"
  | "incomplete_ungrounded"
  | "extra_grounded"
  | "extra_ungrounded";

export type SufficiencyLevel = "high" | "low";

export type CompletenessVerdict = "complete" | "incomplete" | "extra";

export type Verdict = "Y" | "N";

export type TraceStatus = "queued" | "evaluating" | "evaluated" | "failed";
```

### 4.2. Core models

```ts
export interface Project {
  id: string;                 // UUID
  user_id: string;            // UUID, owner
  name: string;
  slug: string;               // URL-safe, unique per user
  created_at: string;         // ISO 8601
  trace_count: number;        // total ever, for sidebar badge
}

export interface ApiKey {
  id: string;                 // UUID
  project_id: string;
  prefix: string;             // visible: "vk_live_AbC12345..." (first 16 chars only)
  name: string | null;        // user-supplied label, e.g. "production"
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ApiKeyWithSecret extends ApiKey {
  secret: string;             // FULL key — returned only on POST create response
}

export interface ContextChunk {
  rank: number;               // 0-indexed
  text: string;
  source: string | null;      // e.g. "compound_interest.md"
  score: number | null;       // similarity, 0..1
}

export interface SufficiencyJudgment {
  sub_question_id: number;
  verdict: Verdict;
  reasoning: string;
  supporting_chunk_ranks: number[];
}

export interface FaithfulnessJudgment {
  claim_id: number;
  verdict: Verdict;
  reasoning: string;
  grounding_chunk_ranks: number[];
}

export interface CompletenessMapping {
  sub_question_id: number;
  covered_by_claim_id: number | null;  // null = uncovered
}

export interface CompletenessJudgment {
  overall: CompletenessVerdict;
  reasoning: string;
  mappings: CompletenessMapping[];
  extra_claim_ids: number[];
}

export interface SubQuestion {
  id: number;
  order_idx: number;
  text: string;
}

export interface Claim {
  id: number;
  order_idx: number;
  text: string;
}

export interface Diagnosis {
  failure_cell: FailureCell;
  sufficiency_level: SufficiencyLevel;
  sufficiency_fraction: number;       // 0..1
  faithfulness_fraction: number;      // 0..1
  n_sub_questions: number;
  n_claims: number;
  n_uncovered_sub_questions: number;
  n_extra_claims: number;
}

export interface Suggestion {
  title: string;
  body: string;
  actions: string[];
  detailed_body: string | null;       // Phase 2 LLM-enriched; null in 0.2.0
  pattern_insights: string[];          // Phase 2 cross-trace; [] in 0.2.0
}
```

---

## 5. Endpoints

### 5.0. Current user

#### `GET /v1/me`

**Auth:** JWT only.
**Description:** Return the authenticated user's profile + trial / subscription state. Powers the settings page and any "trial expiring in X days" banner the dashboard wants to render.

**Response 200:**
```json
{
  "id": "8b21ee...",
  "email": "alice@example.com",
  "display_name": null,
  "trial_started_at": "2026-05-27T10:00:00Z",
  "trial_expires_at": "2026-06-10T10:00:00Z",
  "subscription_status": "trialing",
  "plan_tier": "trial",
  "created_at": "2026-05-27T10:00:00Z"
}
```

**Fields:**
- `subscription_status`: one of `trialing` (default), `active`, `past_due`, `canceled`. Until Stripe is wired (post-alpha), every user stays `trialing` indefinitely.
- `plan_tier`: one of `trial`, `pro`. Mirrors the Stripe price tier once billing is live.
- `display_name`: nullable. Editable via a future `PATCH /v1/me`.

**Errors:**
- `404` if the user's profile row is missing (shouldn't happen — created by a Supabase auth trigger). Surface a friendly error and ping support.

---

### 5.1. Projects

#### `GET /v1/projects`

**Auth:** JWT only.
**Description:** List the authenticated user's projects.

**Response 200:**
```json
{
  "projects": [
    {
      "id": "3f2c0e3a-...",
      "user_id": "8b21ee...",
      "name": "Production RAG",
      "slug": "production-rag",
      "created_at": "2026-05-22T10:00:00Z",
      "trace_count": 1247
    }
  ]
}
```

---

#### `POST /v1/projects`

**Auth:** JWT only.
**Description:** Create a new project owned by the authenticated user.

**Request body:**
```json
{
  "name": "Production RAG",
  "slug": "production-rag"     // optional; auto-generated from name if omitted
}
```

**Response 201:**
```json
{ "project": <Project> }
```

**Errors:**
- `400 validation_error` — name empty, slug invalid (must match `^[a-z0-9-]+$`)
- `409 conflict` — slug already used by this user

---

#### `DELETE /v1/projects/{id}`

**Auth:** JWT only, must own the project.
**Description:** Delete a project. Cascades to all traces, API keys, etc.

**Response 204:** no body.

**Errors:**
- `403 forbidden` — not owner
- `404 not_found` — doesn't exist

---

### 5.2. API Keys

#### `POST /v1/projects/{id}/api-keys`

**Auth:** JWT only, must own the project.
**Description:** Generate a new API key. **Full secret returned ONCE.**

**Request body:**
```json
{
  "name": "production"          // optional label
}
```

**Response 201:**
```json
{
  "api_key": {
    "id": "5e8a1b...",
    "project_id": "3f2c0e3a-...",
    "prefix": "vk_live_AbC12345...",
    "name": "production",
    "created_at": "2026-05-24T12:00:00Z",
    "last_used_at": null,
    "revoked_at": null,
    "secret": "vk_live_AbC123xYz...FULL_SECRET..."
  }
}
```

**Frontend note:** display the `secret` field once on the onboarding/api-keys
page with a copy button. After the user navigates away, it is irrecoverable —
they must rotate to a new key if lost.

---

#### `GET /v1/projects/{id}/api-keys`

**Auth:** JWT only, must own the project.
**Description:** List keys for the project (secrets never returned).

**Response 200:**
```json
{
  "api_keys": [
    {
      "id": "5e8a1b...",
      "project_id": "3f2c0e3a-...",
      "prefix": "vk_live_AbC12345...",
      "name": "production",
      "created_at": "2026-05-24T12:00:00Z",
      "last_used_at": "2026-05-24T14:32:01Z",
      "revoked_at": null
    }
  ]
}
```

---

#### `DELETE /v1/projects/{id}/api-keys/{key_id}`

**Auth:** JWT only, must own the project.
**Description:** Revoke a key. The key remains in the table for audit, but
any subsequent request using it returns `401`.

**Response 204:** no body.

---

### 5.3. Trace ingest (library-only)

#### `POST /v1/traces`

**Auth:** API key only (`vk_live_...`). Project is inferred from the key.
**Description:** Submit a (query, context, response) triple for evaluation.
This is what `veralith.log()` and `@veralith.trace` POST to.

**Rate-limited:** counted against the project's free-tier cap.

**Request body:**
```json
{
  "query": "What is the Rule of 72?",
  "context": [
    {
      "rank": 0,
      "text": "The Rule of 72 is a mental shortcut...",
      "source": "compound_interest.md",
      "score": 0.612
    }
  ],
  "response": "The Rule of 72 is a mental shortcut that estimates...",
  "sync": false                  // optional, default false
}
```

| Field | Type | Notes |
|---|---|---|
| `query` | string, required | Non-empty |
| `context` | array, required | May be empty (the judges will note insufficiency) |
| `context[i].rank` | integer ≥ 0 | Order in retrieval |
| `context[i].text` | string, required | The chunk content |
| `context[i].source` | string, optional | e.g. filename, URL |
| `context[i].score` | number 0..1, optional | Similarity score from retrieval |
| `response` | string, required | The generated answer |
| `sync` | boolean, optional | If `true`, wait up to 30s for evaluation and return the full result. If `false` (default), return immediately with `status: "queued"`. |

**Response 202 (sync=false, default):**
```json
{
  "trace_id": 1247,
  "status": "queued",
  "project_id": "3f2c0e3a-..."
}
```

**Response 200 (sync=true):**
The full TraceDetail object (see §5.5 below). Status will be `"evaluated"`
or `"failed"`.

**Errors:**
- `400 validation_error` — missing fields, malformed body
- `401 unauthenticated` — bad / revoked key
- `429 rate_limit_exceeded` — monthly cap hit. Response details include
  `traces_used`, `traces_limit`, `resets_at` (start of next month UTC).

---

### 5.4. Trace list

#### `GET /v1/projects/{id}/traces`

**Auth:** JWT (project owner) or API key (key's project).
**Description:** List traces, newest first, with optional filters. Used by
the dashboard trace table and live stream.

**Query params:**
| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | int | 50 | Max 200 |
| `offset` | int | 0 | For pagination |
| `cells` | string | (all) | Comma-separated list, e.g. `"complete_grounded,incomplete_grounded"` |
| `since` | ISO 8601 | (none) | Only traces created at-or-after this timestamp |
| `until` | ISO 8601 | (none) | Only traces created strictly before this timestamp |
| `status` | string | (all) | `"queued" \| "evaluating" \| "evaluated" \| "failed"` |
| `sort` | string | `"newest"` | `"newest"` \| `"oldest"` |

**Response 200:**
```json
{
  "traces": [
    {
      "id": 1247,
      "project_id": "3f2c0e3a-...",
      "query": "What is the Rule of 72 and how does it apply to inflation?",
      "response_preview": "The Rule of 72 is a mental shortcut...",
      "status": "evaluated",
      "failure_cell": "complete_grounded",
      "sufficiency_fraction": 1.0,
      "faithfulness_fraction": 1.0,
      "n_sub_questions": 1,
      "n_claims": 5,
      "created_at": "2026-05-24T14:32:01Z",
      "evaluated_at": "2026-05-24T14:32:09Z",
      "latency_ms_total": 8245,
      "cost_usd": 0.0048
    }
  ],
  "total": 1247,
  "has_more": true
}
```

**`response_preview`** is the first 200 characters of the response with
trailing ellipsis if truncated. The full response lives on the detail
endpoint. Cells/fractions may be `null` while `status` is `"queued"` or
`"evaluating"`.

---

### 5.5. Trace detail

#### `GET /v1/projects/{id}/traces/{trace_id}`

**Auth:** JWT (project owner) or API key (key's project).
**Description:** Full evaluation result for one trace.

**Response 200:**
```json
{
  "trace": {
    "id": 1247,
    "project_id": "3f2c0e3a-...",
    "query": "What is the Rule of 72 and how does it apply to inflation?",
    "response": "The Rule of 72 is a mental shortcut...",
    "status": "evaluated",
    "created_at": "2026-05-24T14:32:01Z",
    "evaluated_at": "2026-05-24T14:32:09Z",
    "cost_usd": 0.0048,
    "context_chunks": [
      {
        "rank": 0,
        "text": "The Rule of 72 is a mental shortcut...",
        "source": "compound_interest.md",
        "score": 0.612
      }
    ],
    "sub_questions": [
      {
        "id": 1,
        "order_idx": 0,
        "text": "What is the Rule of 72?"
      }
    ],
    "claims": [
      {
        "id": 1,
        "order_idx": 0,
        "text": "The Rule of 72 is a mental shortcut..."
      }
    ],
    "sufficiency": [
      {
        "sub_question_id": 1,
        "verdict": "Y",
        "reasoning": "Directly defined in chunk 0.",
        "supporting_chunk_ranks": [0]
      }
    ],
    "faithfulness": [
      {
        "claim_id": 1,
        "verdict": "Y",
        "reasoning": "Stated verbatim in chunk 0.",
        "grounding_chunk_ranks": [0]
      }
    ],
    "completeness": {
      "overall": "complete",
      "reasoning": "Q0 fully covered by claims R0..R4.",
      "mappings": [
        { "sub_question_id": 1, "covered_by_claim_id": 1 }
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
      "actions": [],
      "detailed_body": null,
      "pattern_insights": []
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
}
```

**Field notes:**
- `diagnosis`, `suggestion`, `completeness`, judgments may be missing/empty
  while `status` is `"queued"` or `"evaluating"`.
- `errors` is a map of `metric_name -> error_message` for partial failures
  (D3 in the eval design). Empty `{}` on healthy traces.

**Errors:**
- `404 not_found` — trace doesn't exist or isn't in this project

---

### 5.6. Stats

#### `GET /v1/projects/{id}/stats`

**Auth:** JWT (owner) or API key (project).
**Description:** Aggregates for the Overview page's KPI strip and charts.

**Query params:**
| Param | Type | Default | Notes |
|---|---|---|---|
| `since` | ISO 8601 | -24h | Window start |
| `until` | ISO 8601 | now | Window end |
| `bucket` | string | `"hour"` | `"hour"` \| `"day"` |

**Response 200:**
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
  "healthy_rate": 0.869,
  "avg_sufficiency": 0.94,
  "avg_faithfulness": 0.97,
  "total_cost_usd": 6.23,
  "timeseries": [
    {
      "bucket": "2026-05-23T15:00:00Z",
      "count": 156,
      "ok": 142,
      "failed": 14,
      "avg_sufficiency": 0.93,
      "avg_faithfulness": 0.96
    }
  ],
  "deltas": {
    "total_traces_pct_24h": 14.3,
    "healthy_rate_pp_24h": 1.2,
    "avg_sufficiency_delta_24h": 0.0,
    "avg_faithfulness_delta_24h": -0.02
  }
}
```

**Field notes:**
- `healthy_rate` is the proportion of traces with `failure_cell == "complete_grounded"`.
- `timeseries` is sorted oldest → newest.
- `deltas` compares the requested window vs the previous-equivalent window
  (e.g. last 24h vs 24h-before-that).
- All percentages are decimals (0..1), not 0..100.

---

### 5.7. Calibration

#### `GET /v1/projects/{id}/calibration`

**Auth:** JWT (owner) or API key (project).
**Description:** Per-project learned Sufficiency threshold.

**Response 200:**
```json
{
  "threshold": 0.85,
  "n_successful_traces": 127,
  "percentile": 10,
  "using_fallback": false,
  "fallback_value": 1.0,
  "computed_at": "2026-05-24T14:00:00Z"
}
```

**Field notes:**
- `using_fallback: true` means there aren't enough successful traces yet
  (<20). `threshold == fallback_value` in that case.
- `computed_at` reflects when the threshold was last recalibrated.

---

### 5.8. Server-Sent Events (live updates)

#### `GET /v1/projects/{id}/events`

**Auth:** JWT (owner) or API key (project).
**Description:** Server-Sent Events stream. Browsers open this with the
native `EventSource` API; backend pushes events as new traces evaluate.

**Response:** `Content-Type: text/event-stream`, kept open indefinitely.

**Reconnection:** clients may send the `Last-Event-ID` header on reconnect.
Backend uses this to replay events newer than that ID. Server message IDs
correspond to `trace_id` for `trace_evaluated` events.

#### Event types

**`trace_created`** — fired immediately on `POST /v1/traces`, before eval starts.
Optional; clients may ignore.

```
event: trace_created
id: 1247
data: {"id":1247,"query":"...","created_at":"2026-05-24T14:32:01Z","status":"queued"}
```

**`trace_evaluated`** — fired when the eval worker finishes successfully.

```
event: trace_evaluated
id: 1247
data: {"id":1247,"failure_cell":"complete_grounded","sufficiency_fraction":1.0,"faithfulness_fraction":1.0,"n_claims":5,"latency_ms_total":8245,"cost_usd":0.0048,"evaluated_at":"2026-05-24T14:32:09Z"}
```

**`trace_failed`** — fired when the eval worker hits an unrecoverable error.

```
event: trace_failed
id: 1247
data: {"id":1247,"errors":{"faithfulness":"rate limit","sufficiency":"timeout"}}
```

**`keepalive`** — fired every 30 seconds so the connection doesn't time out.
Frontend should ignore.

```
event: keepalive
data: {}
```

#### Frontend usage pattern

```ts
const sse = new EventSource(`/v1/projects/${id}/events`, { withCredentials: true });
sse.addEventListener("trace_evaluated", (e) => {
  const evt = JSON.parse(e.data);
  queryClient.invalidateQueries(["traces", id]);
  queryClient.invalidateQueries(["stats", id]);
});
```

---

### 5.9. Heals (self-heal queue)

Heals are user-curated tickets that group failing traces by an LLM-derived
"suggestion_key" — the canonical failure pattern. One ticket per
`(project_id, suggestion_key)`; new failing traces attach to an existing
open ticket if their root cause matches, otherwise open a new one. The
user decides which to heal, and the customer's Claude Code (configured
via MCP) does the actual code change in the customer's repo.

See `docs/self_heal_architecture.md` for the full design.

#### State machine

```
open ──[user: Heal]──► in_progress
     ├─[user: I fixed manually]──► manually_fixed (terminal)
     └─[user: Just ignore]──────► wont_fix (terminal)

in_progress ──[agent: PR raised]──► pr_raised
            └─[agent: failed]────► failed

pr_raised ──[user: Accept]──► resolved (terminal)
          └─[user: Decline]──► in_progress (close_pr action queued)

failed ──[user: Retry]──► in_progress
       └─[user: Ignore]──► wont_fix
```

Attracting states (new matching traces auto-attach): `open`, `in_progress`,
`pr_raised`. Terminal: `resolved`, `manually_fixed`, `wont_fix`,
`superseded`. `failed` is non-attracting but recoverable via Retry.

---

#### `GET /v1/heals`

**Auth:** JWT only.
**Query params:** `status_filter` (optional, e.g. `open`), `limit` (default 50, max 200).
**Description:** List heal cards across the user's projects, most-recently-updated first.

**Response 200:** array of:
```json
{
  "id": "535a3728-...",
  "project_id": "04b77897-...",
  "status": "open",
  "title": "Failure in grounding responses to factual queries due to lack of relevant data.",
  "suggestion_slug": "fact-retrieval-accuracy",
  "n_traces": 1,
  "pr_url": null,
  "failure_reason": null,
  "last_trace_at": "2026-05-28T13:58:42Z",
  "created_at": "2026-05-28T13:58:42Z",
  "updated_at": "2026-05-28T13:58:42Z"
}
```

`title` is the canonical one-sentence description of the failure pattern (use it as the card title in the UI). `pr_url` is populated for states where a PR exists (`pr_raised`, `resolved`, sometimes `failed`); render it as a clickable link to the customer's git host.

---

#### `GET /v1/heals/{id}`

**Auth:** JWT only.
**Description:** Full card detail. Use for the card-detail pane.

**Response 200:** same fields as the summary, plus:
```json
{
  ...same as summary,
  "suggestion_description": "...",
  "previous_card_id": "eb48d33d-...",
  "pr_raised_at": "2026-05-28T18:01:03Z",
  "pr_accepted_at": null,
  "failed_at": null,
  "failure_patch": null,
  "in_progress_started_at": null,
  "proposed_fixes": [
    {
      "title": "Improve data retrieval mechanism for factual queries",
      "body": "Enhance the system's ability to retrieve relevant data...",
      "classification_confidence": "high",
      "matched_via": "llm"
    }
  ],
  "evidence_traces": [
    {
      "id": "0bf59734-...",
      "query": "What is OpenAI's revenue in 2025?",
      "response": "OpenAI's revenue in 2025 was approximately $4.8 billion.",
      "added_at": "2026-05-28T13:58:42Z",
      "failure_cell": "complete_ungrounded",
      "sufficiency_score": 0.0,
      "faithfulness_score": 0.0
    }
  ]
}
```

- `proposed_fixes`: the per-trace LLM recommendations that classified into THIS card's key. May be empty if the card just opened and no eval has run yet. Multiple entries if multiple distinct fixes were proposed across the card's evidence traces. **Render each as a numbered bullet.**
- `evidence_traces`: most-recent 5 traces attached to this card. **Render as collapsible list** with the query + response visible by default.
- `previous_card_id`: if present, link to that card with a "Previous attempt: PR X — did the issue recur?" banner.

---

#### State-machine action endpoints

All take no body (except where noted). All return:
```json
{ "id": "<card_id>", "status": "<new_status>", "pr_url": "<optional>" }
```

On invalid transition: `409 Conflict` with a message like *"Cannot 'heal' a card in status 'wont_fix'. Allowed statuses: ['failed', 'open']."*

| Method | Path | Legal from | Effect |
|---|---|---|---|
| `POST` | `/v1/heals/{id}/heal` | `open`, `failed` | Status → `in_progress`. Queues a `heal` action for Claude Code. |
| `POST` | `/v1/heals/{id}/accept` | `pr_raised` | Status → `resolved`. Stores `pr_accepted_at`. Terminal. |
| `POST` | `/v1/heals/{id}/decline` | `pr_raised` | Status → `in_progress`. Queues a `close_pr` action for Claude Code to close the PR in the customer's repo. |
| `POST` | `/v1/heals/{id}/retry` | `failed` | Status → `in_progress`. Queues a fresh `heal` action. Clears `failure_reason`. |
| `POST` | `/v1/heals/{id}/dismiss-fixed` | `open`, `failed`, `pr_raised` | Status → `manually_fixed`. Terminal. |
| `POST` | `/v1/heals/{id}/dismiss-ignore` | `open`, `failed`, `pr_raised` | Status → `wont_fix`. Terminal. |

#### Frontend UX guidance

**The Heal page:**
- Default view: open heals at the top, then pr_raised, then in_progress, then everything else.
- Quick filters: `open` / `pr_raised` / `failed` / `terminal`.
- Each row shows: title, n_traces, status badge, last_trace_at (relative time), pr_url (icon link if present).

**The card detail pane:**
- Header: title + status badge.
- "Heal" button: enabled only when `status in {open, failed}`. Variant: "Retry" label when `status == failed`.
- "Ignore" split button: `I fixed manually` and `Just ignore`.
- When `status == pr_raised`: prominent `Accept` (green) and `Decline` (gray) buttons + the PR URL.
- When `status == failed`: show `failure_reason` and `failure_patch` (collapsible code block). Show Retry / Ignore.
- "Heal with Claude Code" badge somewhere: "After clicking Heal, your Claude Code (configured via MCP) will pick up the work, edit the relevant code, and open a PR. Watch this card for updates."

#### Polling

No SSE on heals yet. Poll the list endpoint every 10-15 seconds while the user has the Heal page open. Once a card is in `in_progress` or the user is on its detail view, poll the detail every 5 seconds until the status changes to a terminal or `pr_raised` state.

---

### 5.10. MCP endpoints (informational — agent-facing, not for the dashboard)

Under `/mcp/*`. These are called by the customer's Claude Code (or other agent) using an API key — NOT by the dashboard. Documented here so Dev 2 understands the full loop.

- `GET /mcp/work` — agent polls for pending work for its project.
- `GET /mcp/work/{action_id}` — full work-item details.
- `POST /mcp/work/{action_id}/claim` — lock for 15 min.
- `POST /mcp/work/{action_id}/pr-raised` — agent reports PR raised.
- `POST /mcp/work/{action_id}/failed` — agent couldn't complete.
- `POST /mcp/work/{action_id}/pr-closed` — agent closed a PR (after user Decline).

Dev 2 does not need to call any of these. They power the agent side of the loop. If the dashboard needs to surface "is Claude Code making progress on this heal?" we can later expose a read-only `GET /v1/heals/{id}/action-status` based on the underlying `pending_actions` table.

---

## 6. Rate limiting

### Free-tier cap

- **200 evaluated traces per project per calendar month** (UTC).
- Rejected traces do NOT count against the cap.
- Counter resets at `00:00:00 UTC` on the 1st of each month.

### Enforcement

Only `POST /v1/traces` is rate-limited. Read endpoints are always free.

When a project exceeds the cap, `POST /v1/traces` returns:

```
HTTP/1.1 429 Too Many Requests
Retry-After: <seconds-until-month-rollover>
```

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Project has used 200 of 200 evaluations this month.",
    "details": {
      "traces_used": 200,
      "traces_limit": 200,
      "resets_at": "2026-06-01T00:00:00Z"
    }
  }
}
```

### Counter visibility

The current month's usage is also exposed on `GET /v1/projects/{id}/stats`
as `usage.traces_this_month` / `usage.traces_limit` — frontend can show a
progress bar in the sidebar.

---

## 7. Versioning policy

- All endpoints live under `/v1/`. We will never break a `v1` endpoint.
- Additive changes (new optional fields, new endpoints) are allowed in `v1`
  and do not require a version bump.
- Breaking changes (renaming a field, removing a field, changing a type)
  require a new version path: `/v2/`. Both versions coexist for at least 12 months.
- The Python library version is independent. `veralith 0.2.0` talks to the
  API's `v1`. `veralith 0.3.0` may bump to talking to `v2` if/when that exists.

---

## 8. CORS

The API allows credentialed cross-origin requests from:
- `https://app.veralithai.com`
- `https://veralithai.com`
- `http://localhost:5173` (Vite dev server)

Other origins receive `403`.

---

## 9. Idempotency

`POST /v1/traces` accepts an optional `Idempotency-Key: <uuid>` header.

If the backend has seen this key in the past 24 hours:
- Returns the original response without re-creating the trace.
- Updates `last_used_at` on the API key but does not bill the second call.

If two requests with the same idempotency key arrive concurrently, both
return the same canonical response (one wins the database insert; the other
waits for the result).

Without an idempotency key, every `POST /v1/traces` creates a new trace,
even with identical body content (per the D4 decision: never dedupe).

---

## 10. What's NOT in v1

To prevent scope creep, the following are explicitly out:

- Pagination cursors (use limit/offset only)
- Filtering traces by free-text query
- Bulk operations (`POST /v1/traces:batch`)
- Webhooks
- Audit log
- Team / organization features (a user owns projects directly)
- Public sharing of traces (read-only links)
- Billing / Stripe / paid tiers
- LlamaIndex auto-instrumentation
- Trace export to CSV / JSONL via the API

Each of these earns its own version-bump conversation when there's
demonstrated demand.

---

## 11. Change log for this contract

| Date | Author | Change |
|---|---|---|
| 2026-05-24 | Dev 1 (initial) | Initial freeze for v0.2.0 release. |
| 2026-05-27 | Dev 1 | Added §5.0 `GET /v1/me`. Trial fields land on User schema (`trial_started_at`, `trial_expires_at`, `subscription_status`, `plan_tier`). |
| 2026-05-28 | Dev 1 | Added §5.9 Heals (self-heal queue) — full `/v1/heals/*` surface, state machine, UX guidance for the dashboard. Added §5.10 informational MCP endpoints (agent-facing). |

Any future edit MUST:
1. Add a row to this changelog.
2. Be reflected in `veralithai-backend` and `veralithai-frontend` in the same PR cycle.
3. Be communicated in the team chat so both devs pick it up.

---

## 12. Open questions (answer before coding starts)

These are intentionally still open. Resolve them before Day 2.

1. **Trace ingest payload size limit.** Should we cap context array length? Cap each chunk's text size?
   - **Suggested:** 50 chunks max, 8 KB per chunk text. Reject larger with `400 validation_error`.
2. **Worker timeout.** What's the max time we allow a single trace's eval to run before marking `failed`?
   - **Suggested:** 60 seconds. Most evals finish in 10-15.
3. **Trace retention.** How long do we keep traces in Postgres?
   - **Suggested:** indefinite for v1. Add a "delete traces older than X days" sweeper in v0.3.
4. **API-key prefix display.** How many characters of the secret should the
   `prefix` field include?
   - **Suggested:** `vk_live_` + first 8 chars of the secret. Enough to
     disambiguate when a user has multiple keys; not enough to use.

Lock answers in this doc before either of you starts coding the affected
piece. Update Section 4 / Section 5 accordingly.
