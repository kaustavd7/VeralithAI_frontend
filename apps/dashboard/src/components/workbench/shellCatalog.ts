// AUTO-GENERATED demo catalog for the Workbench Shell ("For the Geeks").
// Paths / params / response SHAPES are grounded in the real Veralith backend
// routes & Pydantic schemas; the response VALUES are realistic DEMO data.
// To wire live later, swap the resolver in WorkbenchDrawer's runCommand() — this
// catalog stays the request / snippet / param source of truth.

export type ParamLoc = 'path' | 'query' | 'body' | 'header';
export type MethodKind = 'read' | 'write' | 'operate';
export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ShellParam {
  name: string;
  loc: ParamLoc;
  type: string;
  required: boolean;
  example: string;
  desc: string;
}
export interface ShellMethod {
  id: string;
  label: string;
  http: HttpVerb;
  path: string;
  kind: MethodKind;
  danger: boolean;
  summary: string;
  params: ShellParam[];
  cli: string;
  snippets: { python: string; node: string; curl: string };
  sampleResponse: unknown;
}
export interface ShellResource {
  resource: string;
  methods: ShellMethod[];
}

export const SHELL_CATALOG: ShellResource[] = [
  {
    "resource": "traces",
    "methods": [
      {
        "id": "traces.list",
        "label": "List traces",
        "http": "GET",
        "path": "/v1/projects/{project_id}/traces",
        "kind": "read",
        "danger": false,
        "summary": "Page through a project's evaluated RAG traces, filterable by failure cell, time window, status, free-text or semantic search.",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_7Qk2mZ",
            "desc": "Project UUID (or resolvable project ref) the traces belong to."
          },
          {
            "name": "limit",
            "loc": "query",
            "type": "integer",
            "required": false,
            "example": "20",
            "desc": "Page size, 1-200. Defaults to 50."
          },
          {
            "name": "offset",
            "loc": "query",
            "type": "integer",
            "required": false,
            "example": "0",
            "desc": "Rows to skip for pagination. Defaults to 0."
          },
          {
            "name": "cells",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "incomplete_ungrounded,complete_ungrounded",
            "desc": "Comma-separated failure cells to keep (incomplete_ungrounded, complete_ungrounded, incomplete_grounded, extra_grounded, extra_ungrounded, complete_grounded)."
          },
          {
            "name": "since",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-01T00:00:00Z",
            "desc": "ISO-8601 lower bound (inclusive) on created_at."
          },
          {
            "name": "until",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-02T00:00:00Z",
            "desc": "ISO-8601 upper bound (exclusive) on created_at."
          },
          {
            "name": "status",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "evaluated",
            "desc": "Filter by derived status: evaluated | evaluating (alias queued) | failed."
          },
          {
            "name": "sort",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "sufficiency_asc",
            "desc": "One of newest, oldest, sufficiency_asc, sufficiency_desc, faithfulness_asc, faithfulness_desc. Defaults to newest. Ignored when semantic is set."
          },
          {
            "name": "q",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "refund policy",
            "desc": "Free-text substring match over query/response."
          },
          {
            "name": "semantic",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "how do returns work",
            "desc": "Meaning-based search; embeds the phrase and ranks by cosine distance. Overrides sort."
          }
        ],
        "cli": "veralith traces.list project_id=proj_7Qk2mZ cells=incomplete_ungrounded sort=sufficiency_asc limit=20",
        "snippets": {
          "python": "import requests\n\nproject_id = \"proj_7Qk2mZ\"\nresp = requests.get(\n    f\"https://api.veralithai.com/v1/projects/{project_id}/traces\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n    params={\"cells\": \"incomplete_ungrounded\", \"sort\": \"sufficiency_asc\", \"limit\": 20},\n    timeout=30,\n)\nresp.raise_for_status()\nprint(resp.json())",
          "node": "const projectId = \"proj_7Qk2mZ\";\nconst params = new URLSearchParams({ cells: \"incomplete_ungrounded\", sort: \"sufficiency_asc\", limit: \"20\" });\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/projects/${projectId}/traces?${params}`,\n  { headers: { Authorization: \"Bearer sk_live_…\" } },\n);\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconsole.log(await resp.json());",
          "curl": "curl -s \"https://api.veralithai.com/v1/projects/proj_7Qk2mZ/traces?cells=incomplete_ungrounded&sort=sufficiency_asc&limit=20\" \\\n  -H \"Authorization: Bearer sk_live_…\""
        },
        "sampleResponse": {
          "traces": [
            {
              "id": "t_9af3c14e2b",
              "project_id": "proj_7Qk2mZ",
              "query": "What is the refund window for annual plans?",
              "response_preview": "Annual plans can be refunded within 30 days of purchase, and we also waive the early-termination fee for enterprise customers…",
              "status": "evaluated",
              "failure_cell": "incomplete_ungrounded",
              "sufficiency_fraction": 0.4,
              "faithfulness_fraction": 0.67,
              "created_at": "2026-06-01T14:22:08.114Z",
              "evaluated_at": "2026-06-01T14:22:11.902Z",
              "latency_ms_total": 1840.5,
              "cost_usd": null
            },
            {
              "id": "t_4c08be77a1",
              "project_id": "proj_7Qk2mZ",
              "query": "Do you support SSO with Okta?",
              "response_preview": "Yes, SSO via Okta is available on the Business and Enterprise tiers and is configured from the security settings page.",
              "status": "evaluated",
              "failure_cell": "complete_grounded",
              "sufficiency_fraction": 1,
              "faithfulness_fraction": 1,
              "created_at": "2026-06-01T13:05:51.330Z",
              "evaluated_at": "2026-06-01T13:05:54.771Z",
              "latency_ms_total": 1203,
              "cost_usd": null
            },
            {
              "id": "t_b1d2f9006c",
              "project_id": "proj_7Qk2mZ",
              "query": "How long does data export take?",
              "response_preview": "Exports usually finish in a few minutes…",
              "status": "evaluating",
              "failure_cell": null,
              "sufficiency_fraction": null,
              "faithfulness_fraction": null,
              "created_at": "2026-06-02T09:41:00.512Z",
              "evaluated_at": null,
              "latency_ms_total": null,
              "cost_usd": null
            }
          ],
          "total": 137,
          "has_more": true
        }
      },
      {
        "id": "traces.get",
        "label": "Get trace detail",
        "http": "GET",
        "path": "/v1/projects/{project_id}/traces/{trace_id}",
        "kind": "read",
        "danger": false,
        "summary": "Fetch one trace with its full evaluation: retrieved chunks, decomposed sub-questions and claims, per-item sufficiency/faithfulness/completeness judgments, diagnosis cell, and heal suggestion.",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_7Qk2mZ",
            "desc": "Project the trace belongs to."
          },
          {
            "name": "trace_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "t_9af3c14e2b",
            "desc": "Trace UUID returned by ingest or list."
          }
        ],
        "cli": "veralith traces.get project_id=proj_7Qk2mZ trace_id=t_9af3c14e2b",
        "snippets": {
          "python": "import requests\n\nproject_id, trace_id = \"proj_7Qk2mZ\", \"t_9af3c14e2b\"\nresp = requests.get(\n    f\"https://api.veralithai.com/v1/projects/{project_id}/traces/{trace_id}\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n    timeout=30,\n)\nresp.raise_for_status()\nprint(resp.json()[\"trace\"][\"diagnosis\"])",
          "node": "const projectId = \"proj_7Qk2mZ\", traceId = \"t_9af3c14e2b\";\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/projects/${projectId}/traces/${traceId}`,\n  { headers: { Authorization: \"Bearer sk_live_…\" } },\n);\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconst { trace } = await resp.json();\nconsole.log(trace.diagnosis);",
          "curl": "curl -s \"https://api.veralithai.com/v1/projects/proj_7Qk2mZ/traces/t_9af3c14e2b\" \\\n  -H \"Authorization: Bearer sk_live_…\""
        },
        "sampleResponse": {
          "trace": {
            "id": "t_9af3c14e2b",
            "project_id": "proj_7Qk2mZ",
            "query": "What is the refund window for annual plans?",
            "response": "Annual plans can be refunded within 30 days of purchase, and we also waive the early-termination fee for enterprise customers.",
            "status": "evaluated",
            "created_at": "2026-06-01T14:22:08.114Z",
            "evaluated_at": "2026-06-01T14:22:11.902Z",
            "cost_usd": 0.000412,
            "latency_ms_total": 1840.5,
            "eval_latency_ms": 3788,
            "context_chunks": [
              {
                "rank": 0,
                "text": "Monthly plans are refundable within 14 days of purchase.",
                "source": "billing_policy.md",
                "score": 0.81
              },
              {
                "rank": 1,
                "text": "Enterprise contracts are negotiated individually with the sales team.",
                "source": "enterprise_terms.md",
                "score": 0.74
              }
            ],
            "sub_questions": [
              {
                "id": 1,
                "text": "What is the refund window for annual plans?",
                "order_idx": 0
              }
            ],
            "claims": [
              {
                "id": 1,
                "text": "Annual plans can be refunded within 30 days of purchase.",
                "order_idx": 0
              },
              {
                "id": 2,
                "text": "The early-termination fee is waived for enterprise customers.",
                "order_idx": 1
              }
            ],
            "sufficiency": [
              {
                "sub_question_id": 1,
                "verdict": "N",
                "reasoning": "No retrieved chunk states the annual-plan refund window; chunk 0 covers monthly plans only.",
                "supporting_chunk_ranks": []
              }
            ],
            "faithfulness": [
              {
                "claim_id": 1,
                "verdict": "N",
                "reasoning": "30-day annual window is not supported by any chunk; chunk 0 says 14 days for monthly.",
                "grounding_chunk_ranks": []
              },
              {
                "claim_id": 2,
                "verdict": "N",
                "reasoning": "No chunk mentions waiving the early-termination fee.",
                "grounding_chunk_ranks": []
              }
            ],
            "completeness": {
              "overall": "incomplete",
              "mappings": [
                {
                  "sub_question_id": 1,
                  "covered_by_claim_id": 1
                }
              ],
              "extra_claim_ids": [
                2
              ],
              "reasoning": "The query's single sub-question is addressed but the answer is unsupported, and claim 2 adds unrequested enterprise content."
            },
            "diagnosis": {
              "failure_cell": "incomplete_ungrounded",
              "sufficiency_level": "low",
              "sufficiency_fraction": 0.4,
              "faithfulness_fraction": 0,
              "n_sub_questions": 1,
              "n_claims": 2,
              "n_uncovered_sub_questions": 1,
              "n_extra_claims": 1
            },
            "suggestion": {
              "title": "Retrieval is missing annual-plan refund terms",
              "body": "The answer fabricates a 30-day annual refund window because no retrieved chunk covers annual plans. Index the annual-plan section of billing_policy.md and add a guard that abstains when refund terms for the requested plan tier are absent.",
              "actions": [
                "Ingest the annual-plan clause of billing_policy.md into the vector store.",
                "Add an abstain-if-unsupported instruction to the answer prompt."
              ],
              "detailed_body": null,
              "pattern_insights": []
            },
            "latency_ms": {
              "decompose": 612,
              "sufficiency": 1190.4,
              "faithfulness": 1402.1,
              "completeness": 583.5
            },
            "errors": {}
          }
        }
      },
      {
        "id": "traces.send",
        "label": "Send (ingest) a trace",
        "http": "POST",
        "path": "/v1/traces",
        "kind": "write",
        "danger": true,
        "summary": "Ingest one RAG call (query, response, retrieved chunks) with your project API key; the trace is persisted and evaluation runs asynchronously.",
        "params": [
          {
            "name": "Authorization",
            "loc": "header",
            "type": "string",
            "required": true,
            "example": "Bearer sk_live_…",
            "desc": "Project API key (vk_live_/sk_live_) — ingestion is API-key only; the project is taken from the key."
          },
          {
            "name": "query",
            "loc": "body",
            "type": "string",
            "required": true,
            "example": "What is the refund window for annual plans?",
            "desc": "The end-user query sent to your RAG pipeline. Non-empty."
          },
          {
            "name": "response",
            "loc": "body",
            "type": "string",
            "required": true,
            "example": "Annual plans can be refunded within 30 days of purchase.",
            "desc": "The answer your pipeline generated. Non-empty."
          },
          {
            "name": "retrieved_chunks",
            "loc": "body",
            "type": "array",
            "required": false,
            "example": "[{\"text\":\"Monthly plans are refundable within 14 days.\",\"rank\":0,\"source\":\"billing_policy.md\",\"score\":0.81}]",
            "desc": "Chunks fed to the LLM. Each item: text, rank (0=top), optional source, optional score. Defaults to []."
          },
          {
            "name": "metadata",
            "loc": "body",
            "type": "object",
            "required": false,
            "example": "{\"env\":\"prod\",\"user_tier\":\"enterprise\"}",
            "desc": "Arbitrary key/value tags stored with the trace."
          },
          {
            "name": "latency_ms_total",
            "loc": "body",
            "type": "number",
            "required": false,
            "example": "1840.5",
            "desc": "Your RAG pipeline's response time in ms (>=0). Auto-measured with @veralith.trace; pass explicitly when calling log() directly."
          }
        ],
        "cli": "veralith traces.send query=\"What is the refund window for annual plans?\" response=\"Annual plans can be refunded within 30 days.\" latency_ms_total=1840.5",
        "snippets": {
          "python": "import veralith\n\n# Reads VERALITH_API_KEY from the environment (sk_live_…)\nresult = veralith.log(\n    query=\"What is the refund window for annual plans?\",\n    context=[\n        {\"text\": \"Monthly plans are refundable within 14 days.\", \"rank\": 0, \"source\": \"billing_policy.md\", \"score\": 0.81},\n        {\"text\": \"Enterprise contracts are negotiated individually.\", \"rank\": 1, \"source\": \"enterprise_terms.md\", \"score\": 0.74},\n    ],\n    response=\"Annual plans can be refunded within 30 days of purchase.\",\n    latency_ms=1840.5,\n)\nprint(result)  # server-assigned trace id (UUID string)",
          "node": "import { Veralith } from \"veralith\";\n\nconst v = new Veralith(\"sk_live_…\");\nconst traceId = await v.log({\n  query: \"What is the refund window for annual plans?\",\n  context: [\n    { text: \"Monthly plans are refundable within 14 days.\", rank: 0, source: \"billing_policy.md\", score: 0.81 },\n    { text: \"Enterprise contracts are negotiated individually.\", rank: 1, source: \"enterprise_terms.md\", score: 0.74 },\n  ],\n  response: \"Annual plans can be refunded within 30 days of purchase.\",\n  latencyMs: 1840.5,\n});\nconsole.log(traceId);",
          "curl": "curl -s -X POST \"https://api.veralithai.com/v1/traces\" \\\n  -H \"Authorization: Bearer sk_live_…\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"query\": \"What is the refund window for annual plans?\",\n    \"response\": \"Annual plans can be refunded within 30 days of purchase.\",\n    \"retrieved_chunks\": [\n      {\"text\": \"Monthly plans are refundable within 14 days.\", \"rank\": 0, \"source\": \"billing_policy.md\", \"score\": 0.81}\n    ],\n    \"latency_ms_total\": 1840.5\n  }'"
        },
        "sampleResponse": {
          "id": "t_9af3c14e2b",
          "status": "accepted",
          "created_at": "2026-06-02T09:41:00.512Z"
        }
      },
      {
        "id": "traces.export",
        "label": "Export traces as CSV",
        "http": "GET",
        "path": "/v1/projects/{project_id}/traces.csv",
        "kind": "read",
        "danger": false,
        "summary": "Stream matching traces (same filters as the list) as a CSV attachment, one row per trace with scores, cells, and latencies. Capped at 50,000 rows.",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_7Qk2mZ",
            "desc": "Project whose traces to export."
          },
          {
            "name": "cells",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "incomplete_ungrounded,extra_ungrounded",
            "desc": "Comma-separated failure cells to include."
          },
          {
            "name": "since",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-01T00:00:00Z",
            "desc": "ISO-8601 lower bound (inclusive) on created_at."
          },
          {
            "name": "until",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-02T00:00:00Z",
            "desc": "ISO-8601 upper bound (exclusive) on created_at."
          },
          {
            "name": "status",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "evaluated",
            "desc": "Filter by derived status: evaluated | evaluating (alias queued) | failed."
          }
        ],
        "cli": "veralith traces.export project_id=proj_7Qk2mZ cells=incomplete_ungrounded since=2026-06-01T00:00:00Z > traces.csv",
        "snippets": {
          "python": "import requests\n\nproject_id = \"proj_7Qk2mZ\"\nresp = requests.get(\n    f\"https://api.veralithai.com/v1/projects/{project_id}/traces.csv\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n    params={\"cells\": \"incomplete_ungrounded\", \"since\": \"2026-06-01T00:00:00Z\"},\n    timeout=60,\n)\nresp.raise_for_status()\nwith open(\"traces.csv\", \"wb\") as f:\n    f.write(resp.content)",
          "node": "const projectId = \"proj_7Qk2mZ\";\nconst params = new URLSearchParams({ cells: \"incomplete_ungrounded\", since: \"2026-06-01T00:00:00Z\" });\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/projects/${projectId}/traces.csv?${params}`,\n  { headers: { Authorization: \"Bearer sk_live_…\" } },\n);\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconst csv = await resp.text();\nconsole.log(csv);",
          "curl": "curl -s \"https://api.veralithai.com/v1/projects/proj_7Qk2mZ/traces.csv?cells=incomplete_ungrounded&since=2026-06-01T00:00:00Z\" \\\n  -H \"Authorization: Bearer sk_live_…\" -o traces.csv"
        },
        "sampleResponse": {
          "content_type": "text/csv",
          "content_disposition": "attachment; filename=\"traces_proj_7Qk2mZ.csv\"",
          "csv": "id,created_at,evaluated_at,status,failure_cell,sufficiency_fraction,faithfulness_fraction,latency_ms_total,eval_latency_ms,query,response\nt_9af3c14e2b,2026-06-01T14:22:08.114Z,2026-06-01T14:22:11.902Z,evaluated,incomplete_ungrounded,0.4,0.67,1840.5,3788.0,What is the refund window for annual plans?,Annual plans can be refunded within 30 days of purchase.\nt_4c08be77a1,2026-06-01T13:05:51.330Z,2026-06-01T13:05:54.771Z,evaluated,complete_grounded,1.0,1.0,1203.0,3120.0,Do you support SSO with Okta?,Yes SSO via Okta is available on the Business and Enterprise tiers.\nt_b1d2f9006c,2026-06-02T09:41:00.512Z,,evaluating,,,,,,How long does data export take?,Exports usually finish in a few minutes."
        }
      }
    ]
  },
  {
    "resource": "stats",
    "methods": [
      {
        "id": "stats.get",
        "label": "Get dashboard stats",
        "http": "GET",
        "path": "/v1/projects/{project_id}/stats",
        "kind": "read",
        "danger": false,
        "summary": "Windowed KPI aggregates for a project: total traces, healthy rate, failure-cell breakdown, sufficiency/faithfulness averages, RAG + eval latency percentiles, a per-bucket timeseries, 24h deltas, and connection/uptime awareness.",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_3f9a1c7d2e",
            "desc": "Project id (UUID) or resolvable project slug."
          },
          {
            "name": "since",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-01T00:00:00Z",
            "desc": "ISO-8601 window start. Defaults to until - 24h."
          },
          {
            "name": "until",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-02T00:00:00Z",
            "desc": "ISO-8601 window end. Defaults to now (UTC)."
          },
          {
            "name": "bucket",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "hour",
            "desc": "Timeseries bucket granularity. One of: hour, day. Default hour."
          }
        ],
        "cli": "veralith stats.get project_id=proj_3f9a1c7d2e since=2026-06-01T00:00:00Z until=2026-06-02T00:00:00Z bucket=hour",
        "snippets": {
          "python": "import requests\n\nPROJECT_ID = \"proj_3f9a1c7d2e\"\nresp = requests.get(\n    f\"https://api.veralithai.com/v1/projects/{PROJECT_ID}/stats\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n    params={\n        \"since\": \"2026-06-01T00:00:00Z\",\n        \"until\": \"2026-06-02T00:00:00Z\",\n        \"bucket\": \"hour\",\n    },\n)\nresp.raise_for_status()\nstats = resp.json()\nprint(stats[\"healthy_rate\"], stats[\"by_cell\"])",
          "node": "const PROJECT_ID = \"proj_3f9a1c7d2e\";\nconst params = new URLSearchParams({\n  since: \"2026-06-01T00:00:00Z\",\n  until: \"2026-06-02T00:00:00Z\",\n  bucket: \"hour\",\n});\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/projects/${PROJECT_ID}/stats?${params}`,\n  { headers: { Authorization: \"Bearer sk_live_…\" } }\n);\nif (!resp.ok) throw new Error(`stats failed: ${resp.status}`);\nconst stats = await resp.json();\nconsole.log(stats.healthy_rate, stats.by_cell);",
          "curl": "curl -G \"https://api.veralithai.com/v1/projects/proj_3f9a1c7d2e/stats\" \\\n  -H \"Authorization: Bearer sk_live_…\" \\\n  --data-urlencode \"since=2026-06-01T00:00:00Z\" \\\n  --data-urlencode \"until=2026-06-02T00:00:00Z\" \\\n  --data-urlencode \"bucket=hour\""
        },
        "sampleResponse": {
          "total_traces": 1284,
          "by_cell": {
            "complete_grounded": 947,
            "complete_ungrounded": 88,
            "incomplete_grounded": 102,
            "incomplete_ungrounded": 121,
            "extra_grounded": 14,
            "extra_ungrounded": 12
          },
          "usage": {
            "traces_this_month": 5392
          },
          "healthy_rate": 0.7375,
          "avg_sufficiency": 0.6918,
          "avg_faithfulness": 0.8142,
          "total_cost_usd": 2.481337,
          "rag_latency_ms": {
            "p50": 412,
            "p90": 980.5,
            "p95": 1340.2,
            "p99": 2210.7,
            "sample_size": 1284
          },
          "eval_latency_ms": {
            "p50": 1880,
            "p90": 3120.4,
            "p95": 3950.1,
            "p99": 5602.9,
            "sample_size": 1271
          },
          "timeseries": [
            {
              "bucket": "2026-06-01T22:00:00Z",
              "count": 54,
              "ok": 39,
              "failed": 15,
              "avg_sufficiency": 0.6802,
              "avg_faithfulness": 0.8011,
              "rag_latency_p50_ms": 405.3
            },
            {
              "bucket": "2026-06-01T23:00:00Z",
              "count": 61,
              "ok": 47,
              "failed": 14,
              "avg_sufficiency": 0.7011,
              "avg_faithfulness": 0.8233,
              "rag_latency_p50_ms": 398.7
            },
            {
              "bucket": "2026-06-02T00:00:00Z",
              "count": 48,
              "ok": 35,
              "failed": 13,
              "avg_sufficiency": 0.674,
              "avg_faithfulness": 0.7995,
              "rag_latency_p50_ms": 421
            }
          ],
          "deltas": {
            "total_traces_pct_24h": 12.4,
            "healthy_rate_pp_24h": 0.0312,
            "avg_sufficiency_delta_24h": -0.0185,
            "avg_faithfulness_delta_24h": 0.0094,
            "total_cost_usd_delta_24h": 0.412006
          },
          "last_trace_at": "2026-06-02T00:14:52Z",
          "connection_state": "live",
          "avg_gap_seconds": 67.3,
          "sdk_version": "0.2.1",
          "uptime_pct": 95.8
        }
      },
      {
        "id": "stats.distributions",
        "label": "Get score distributions",
        "http": "GET",
        "path": "/v1/projects/{project_id}/stats/distributions",
        "kind": "read",
        "danger": false,
        "summary": "Histogram distributions of sufficiency and faithfulness judge scores over the window, with per-metric mean, median, and sample size. Bins are fixed-width across [0,1].",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_3f9a1c7d2e",
            "desc": "Project id (UUID) or resolvable project slug."
          },
          {
            "name": "since",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-01T00:00:00Z",
            "desc": "ISO-8601 window start. Defaults to until - 24h."
          },
          {
            "name": "until",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-02T00:00:00Z",
            "desc": "ISO-8601 window end. Defaults to now (UTC)."
          },
          {
            "name": "bin_width",
            "loc": "query",
            "type": "number",
            "required": false,
            "example": "0.05",
            "desc": "Histogram bin width. Must be one of: 0.01, 0.05, 0.10, 0.25. Default 0.05. Other values return 400."
          }
        ],
        "cli": "veralith stats.distributions project_id=proj_3f9a1c7d2e bin_width=0.05 since=2026-06-01T00:00:00Z",
        "snippets": {
          "python": "import requests\n\nPROJECT_ID = \"proj_3f9a1c7d2e\"\nresp = requests.get(\n    f\"https://api.veralithai.com/v1/projects/{PROJECT_ID}/stats/distributions\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n    params={\"bin_width\": 0.05, \"since\": \"2026-06-01T00:00:00Z\"},\n)\nresp.raise_for_status()\ndist = resp.json()\nprint(dist[\"sufficiency\"][\"median\"], dist[\"sufficiency\"][\"bins\"][:3])",
          "node": "const PROJECT_ID = \"proj_3f9a1c7d2e\";\nconst params = new URLSearchParams({ bin_width: \"0.05\", since: \"2026-06-01T00:00:00Z\" });\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/projects/${PROJECT_ID}/stats/distributions?${params}`,\n  { headers: { Authorization: \"Bearer sk_live_…\" } }\n);\nif (!resp.ok) throw new Error(`distributions failed: ${resp.status}`);\nconst dist = await resp.json();\nconsole.log(dist.sufficiency.median, dist.faithfulness.median);",
          "curl": "curl -G \"https://api.veralithai.com/v1/projects/proj_3f9a1c7d2e/stats/distributions\" \\\n  -H \"Authorization: Bearer sk_live_…\" \\\n  --data-urlencode \"bin_width=0.05\" \\\n  --data-urlencode \"since=2026-06-01T00:00:00Z\""
        },
        "sampleResponse": {
          "sufficiency": {
            "bins": [
              {
                "lower": 0.35,
                "upper": 0.4,
                "count": 18
              },
              {
                "lower": 0.4,
                "upper": 0.45,
                "count": 41
              },
              {
                "lower": 0.45,
                "upper": 0.5,
                "count": 63
              }
            ],
            "mean": 0.6918,
            "median": 0.71,
            "sample_size": 1271
          },
          "faithfulness": {
            "bins": [
              {
                "lower": 0.75,
                "upper": 0.8,
                "count": 96
              },
              {
                "lower": 0.8,
                "upper": 0.85,
                "count": 154
              },
              {
                "lower": 0.85,
                "upper": 0.9,
                "count": 188
              }
            ],
            "mean": 0.8142,
            "median": 0.83,
            "sample_size": 1271
          },
          "threshold": null
        }
      },
      {
        "id": "stats.calibration",
        "label": "Get calibration threshold",
        "http": "GET",
        "path": "/v1/projects/{project_id}/calibration",
        "kind": "read",
        "danger": false,
        "summary": "Project sufficiency calibration threshold. Currently a stub: real per-project threshold storage is deferred, so it reports the fallback state (using_fallback=true, no computed threshold yet).",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_3f9a1c7d2e",
            "desc": "Project id (UUID) or resolvable project slug."
          }
        ],
        "cli": "veralith stats.calibration project_id=proj_3f9a1c7d2e",
        "snippets": {
          "python": "import requests\n\nPROJECT_ID = \"proj_3f9a1c7d2e\"\nresp = requests.get(\n    f\"https://api.veralithai.com/v1/projects/{PROJECT_ID}/calibration\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n)\nresp.raise_for_status()\ncal = resp.json()\nprint(cal[\"using_fallback\"], cal[\"threshold\"])",
          "node": "const PROJECT_ID = \"proj_3f9a1c7d2e\";\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/projects/${PROJECT_ID}/calibration`,\n  { headers: { Authorization: \"Bearer sk_live_…\" } }\n);\nif (!resp.ok) throw new Error(`calibration failed: ${resp.status}`);\nconst cal = await resp.json();\nconsole.log(cal.using_fallback, cal.threshold);",
          "curl": "curl \"https://api.veralithai.com/v1/projects/proj_3f9a1c7d2e/calibration\" \\\n  -H \"Authorization: Bearer sk_live_…\""
        },
        "sampleResponse": {
          "threshold": null,
          "n_successful_traces": 0,
          "percentile": null,
          "using_fallback": true,
          "fallback_value": null,
          "computed_at": null
        }
      }
    ]
  },
  {
    "resource": "insights",
    "methods": [
      {
        "id": "insights.summary",
        "label": "Get RAG summary",
        "http": "GET",
        "path": "/v1/projects/{project_id}/insights/summary",
        "kind": "read",
        "danger": false,
        "summary": "Cached, LLM-written 'state of your RAG' digest over the last 7 days, with prioritized recommendations and the context it was based on.",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_8Qx2mK4vL7",
            "desc": "Project to summarize. Accepts the project's id or slug; resolved server-side."
          }
        ],
        "cli": "veralith insights.summary project_id=proj_8Qx2mK4vL7",
        "snippets": {
          "python": "import requests\n\nresp = requests.get(\n    \"https://api.veralithai.com/v1/projects/proj_8Qx2mK4vL7/insights/summary\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n)\nresp.raise_for_status()\nprint(resp.json()[\"summary\"])",
          "node": "const res = await fetch(\n  \"https://api.veralithai.com/v1/projects/proj_8Qx2mK4vL7/insights/summary\",\n  { headers: { Authorization: \"Bearer sk_live_…\" } },\n);\nif (!res.ok) throw new Error(`HTTP ${res.status}`);\nconst data = await res.json();\nconsole.log(data.summary);",
          "curl": "curl -s https://api.veralithai.com/v1/projects/proj_8Qx2mK4vL7/insights/summary \\\n  -H \"Authorization: Bearer sk_live_…\""
        },
        "sampleResponse": {
          "summary": "Over the last 7 days your RAG answered 1,284 queries with a 14.2% failure rate, up 2.1 points from the prior week. Most failures are ungrounded (8.7% hallucination rate), concentrated in billing and refund questions where retrieval is coming back thin. Two heal cards are open against the worst categories; one is a recurrence of a regression you previously resolved.",
          "highlights": [
            "Refund-policy questions are your top failure category (23 failing traces, +35%) and retrieval sufficiency is only 0.41 — add refund-window docs to the knowledge base.",
            "The 'sso-saml-setup' category recurred after being resolved 9 days ago — review heal card hc_4f8a2c before it ships again.",
            "Hallucination rate (8.7%) is now most of your failures — prioritize the 3 coverage gaps below over prompt tweaks."
          ],
          "based_on": {
            "window_days": 7,
            "total_traces": 1284,
            "failure_rate": 0.142,
            "hallucination_rate": 0.087,
            "failure_rate_trend_pp": 2.1,
            "total_failure_categories": 11,
            "n_coverage_gaps": 3
          },
          "generated_at": "2026-06-02T06:14:09Z"
        }
      },
      {
        "id": "insights.categories",
        "label": "List failure categories",
        "http": "GET",
        "path": "/v1/projects/{project_id}/insights/categories",
        "kind": "read",
        "danger": false,
        "summary": "Failure-category leaderboard over a window, each row carrying volume, trend vs the previous equal window, avg sufficiency/faithfulness, the dominant failure cell, an is_new flag, and the latest heal state (incl. recurrence).",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_8Qx2mK4vL7",
            "desc": "Project to rank categories for. Accepts id or slug."
          },
          {
            "name": "since",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-01T00:00:00Z",
            "desc": "ISO-8601 start of the window (trace.created_at >= since). Defaults to 24h before 'until'."
          },
          {
            "name": "until",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-02T00:00:00Z",
            "desc": "ISO-8601 end of the window (trace.created_at < until). Defaults to now."
          },
          {
            "name": "limit",
            "loc": "query",
            "type": "integer",
            "required": false,
            "example": "20",
            "desc": "Max rows to return (1–100, default 20). total_categories still reports the true count."
          }
        ],
        "cli": "veralith insights.categories project_id=proj_8Qx2mK4vL7 since=2026-06-01T00:00:00Z limit=20",
        "snippets": {
          "python": "import requests\n\nresp = requests.get(\n    \"https://api.veralithai.com/v1/projects/proj_8Qx2mK4vL7/insights/categories\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n    params={\"since\": \"2026-06-01T00:00:00Z\", \"limit\": 20},\n)\nresp.raise_for_status()\nfor cat in resp.json()[\"categories\"]:\n    print(cat[\"slug\"], cat[\"trace_count\"], cat[\"trend_pct\"])",
          "node": "const url = new URL(\n  \"https://api.veralithai.com/v1/projects/proj_8Qx2mK4vL7/insights/categories\",\n);\nurl.searchParams.set(\"since\", \"2026-06-01T00:00:00Z\");\nurl.searchParams.set(\"limit\", \"20\");\nconst res = await fetch(url, { headers: { Authorization: \"Bearer sk_live_…\" } });\nif (!res.ok) throw new Error(`HTTP ${res.status}`);\nconst { categories } = await res.json();\nconsole.log(categories);",
          "curl": "curl -s -G https://api.veralithai.com/v1/projects/proj_8Qx2mK4vL7/insights/categories \\\n  -H \"Authorization: Bearer sk_live_…\" \\\n  --data-urlencode \"since=2026-06-01T00:00:00Z\" \\\n  --data-urlencode \"limit=20\""
        },
        "sampleResponse": {
          "since": "2026-06-01T00:00:00Z",
          "until": "2026-06-02T00:00:00Z",
          "total_categories": 11,
          "categories": [
            {
              "suggestion_key_id": "sk_2b91d7",
              "slug": "refund-policy-window",
              "description": "Answers about refund eligibility and the 30-day return window lack supporting docs.",
              "trace_count": 23,
              "trace_count_prev": 17,
              "trend_pct": 35.3,
              "avg_sufficiency": 0.41,
              "avg_faithfulness": 0.62,
              "dominant_cell": "iu",
              "is_new": false,
              "heal": {
                "card_id": "hc_4f8a2c",
                "status": "pr_raised",
                "is_recurrence": true,
                "pr_url": "https://github.com/acme/docs/pull/812"
              }
            },
            {
              "suggestion_key_id": "sk_7c3e0a",
              "slug": "sso-saml-setup",
              "description": "SAML/SSO configuration steps are answered with fabricated metadata URLs.",
              "trace_count": 14,
              "trace_count_prev": 0,
              "trend_pct": null,
              "avg_sufficiency": 0.58,
              "avg_faithfulness": 0.39,
              "dominant_cell": "cu",
              "is_new": true,
              "heal": {
                "card_id": "hc_9d12fb",
                "status": "open",
                "is_recurrence": false,
                "pr_url": null
              }
            },
            {
              "suggestion_key_id": "sk_a04f55",
              "slug": "pricing-enterprise-tiers",
              "description": "Enterprise pricing questions retrieve outdated tier docs.",
              "trace_count": 9,
              "trace_count_prev": 11,
              "trend_pct": -18.2,
              "avg_sufficiency": 0.66,
              "avg_faithfulness": 0.71,
              "dominant_cell": "ig",
              "is_new": false,
              "heal": null
            }
          ]
        }
      },
      {
        "id": "insights.coverageGaps",
        "label": "List coverage gaps",
        "http": "GET",
        "path": "/v1/projects/{project_id}/insights/coverage-gaps",
        "kind": "read",
        "danger": false,
        "summary": "Failure categories whose retrieval is consistently insufficient (sufficiency < threshold) — likely knowledge-base gaps. Each gap reports low-sufficiency vs total failures, avg sufficiency, the dominant cell, and a few example questions retrieval whiffed on.",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_8Qx2mK4vL7",
            "desc": "Project to scan for KB coverage gaps. Accepts id or slug."
          },
          {
            "name": "since",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-01T00:00:00Z",
            "desc": "ISO-8601 start of the window (trace.created_at >= since). Defaults to 24h before 'until'."
          },
          {
            "name": "until",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "2026-06-02T00:00:00Z",
            "desc": "ISO-8601 end of the window (trace.created_at < until). Defaults to now."
          },
          {
            "name": "threshold",
            "loc": "query",
            "type": "number",
            "required": false,
            "example": "0.5",
            "desc": "Sufficiency cutoff in (0.0, 1.0]; failures with sufficiency below this count as gaps. Default 0.5. Echoed back as sufficiency_threshold."
          },
          {
            "name": "limit",
            "loc": "query",
            "type": "integer",
            "required": false,
            "example": "20",
            "desc": "Max gap rows to return (1–100, default 20). total_gaps still reports the true count."
          }
        ],
        "cli": "veralith insights.coverageGaps project_id=proj_8Qx2mK4vL7 threshold=0.5 since=2026-06-01T00:00:00Z",
        "snippets": {
          "python": "import requests\n\nresp = requests.get(\n    \"https://api.veralithai.com/v1/projects/proj_8Qx2mK4vL7/insights/coverage-gaps\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n    params={\"threshold\": 0.5, \"since\": \"2026-06-01T00:00:00Z\"},\n)\nresp.raise_for_status()\nfor gap in resp.json()[\"gaps\"]:\n    print(gap[\"slug\"], gap[\"low_sufficiency_count\"], \"of\", gap[\"total_failures\"])",
          "node": "const url = new URL(\n  \"https://api.veralithai.com/v1/projects/proj_8Qx2mK4vL7/insights/coverage-gaps\",\n);\nurl.searchParams.set(\"threshold\", \"0.5\");\nurl.searchParams.set(\"since\", \"2026-06-01T00:00:00Z\");\nconst res = await fetch(url, { headers: { Authorization: \"Bearer sk_live_…\" } });\nif (!res.ok) throw new Error(`HTTP ${res.status}`);\nconst { gaps } = await res.json();\nconsole.log(gaps);",
          "curl": "curl -s -G https://api.veralithai.com/v1/projects/proj_8Qx2mK4vL7/insights/coverage-gaps \\\n  -H \"Authorization: Bearer sk_live_…\" \\\n  --data-urlencode \"threshold=0.5\" \\\n  --data-urlencode \"since=2026-06-01T00:00:00Z\""
        },
        "sampleResponse": {
          "since": "2026-06-01T00:00:00Z",
          "until": "2026-06-02T00:00:00Z",
          "sufficiency_threshold": 0.5,
          "total_gaps": 3,
          "gaps": [
            {
              "suggestion_key_id": "sk_2b91d7",
              "slug": "refund-policy-window",
              "description": "Answers about refund eligibility and the 30-day return window lack supporting docs.",
              "low_sufficiency_count": 18,
              "total_failures": 23,
              "avg_sufficiency": 0.4,
              "dominant_cell": "iu",
              "sample_queries": [
                "Can I get a refund 45 days after purchase?",
                "What is your refund window for annual plans?",
                "How do I request a partial refund for unused seats?"
              ]
            },
            {
              "suggestion_key_id": "sk_c8810f",
              "slug": "data-residency-eu",
              "description": "Questions about EU data residency retrieve no matching compliance docs.",
              "low_sufficiency_count": 11,
              "total_failures": 12,
              "avg_sufficiency": 0.33,
              "dominant_cell": "iu",
              "sample_queries": [
                "Is my data stored in the EU?",
                "Do you offer Frankfurt region hosting?"
              ]
            }
          ]
        }
      }
    ]
  },
  {
    "resource": "heals",
    "methods": [
      {
        "id": "heals.list",
        "label": "List heal cards",
        "http": "GET",
        "path": "/v1/heals",
        "kind": "read",
        "danger": false,
        "summary": "List the heal cards across your projects, newest-updated first; optionally filter by status.",
        "params": [
          {
            "name": "status_filter",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "open",
            "desc": "Narrow to one status: open | in_progress | pr_raised | resolved | failed | manually_fixed | wont_fix | superseded."
          },
          {
            "name": "limit",
            "loc": "query",
            "type": "integer",
            "required": false,
            "example": "50",
            "desc": "Max cards to return (default 50)."
          }
        ],
        "cli": "veralith heals.list status_filter=open limit=20",
        "snippets": {
          "python": "import requests\n\nresp = requests.get(\n    \"https://api.veralithai.com/v1/heals\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n    params={\"status_filter\": \"open\", \"limit\": 20},\n)\nresp.raise_for_status()\nfor card in resp.json():\n    print(card[\"id\"], card[\"status\"], card[\"title\"])",
          "node": "const resp = await fetch(\n  \"https://api.veralithai.com/v1/heals?status_filter=open&limit=20\",\n  { headers: { Authorization: \"Bearer sk_live_…\" } }\n);\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconst cards = await resp.json();\nfor (const card of cards) console.log(card.id, card.status, card.title);",
          "curl": "curl -s 'https://api.veralithai.com/v1/heals?status_filter=open&limit=20' \\\n  -H 'Authorization: Bearer sk_live_…'"
        },
        "sampleResponse": [
          {
            "id": "hc_7b21f4",
            "project_id": "proj_3f9c2a",
            "status": "open",
            "title": "Retriever returns chunks that omit refund-window policy details",
            "suggestion_slug": "refund-window-retrieval-gap",
            "n_traces": 14,
            "pr_url": null,
            "failure_reason": null,
            "last_trace_at": "2026-06-01T09:42:11+00:00",
            "is_recurrence": false,
            "created_at": "2026-05-28T14:03:55+00:00",
            "updated_at": "2026-06-01T09:42:30+00:00"
          },
          {
            "id": "hc_9d40ab",
            "project_id": "proj_3f9c2a",
            "status": "pr_raised",
            "title": "Answers add SLA numbers not present in retrieved context",
            "suggestion_slug": "sla-hallucination-extra-ungrounded",
            "n_traces": 6,
            "pr_url": "https://github.com/acme/docs-rag/pull/218",
            "failure_reason": null,
            "last_trace_at": "2026-05-31T18:11:02+00:00",
            "is_recurrence": true,
            "created_at": "2026-05-30T11:20:00+00:00",
            "updated_at": "2026-06-01T07:55:14+00:00"
          },
          {
            "id": "hc_c1e882",
            "project_id": "proj_88aa01",
            "status": "failed",
            "title": "Chunking splits API auth steps across boundaries (incomplete answers)",
            "suggestion_slug": "auth-steps-chunk-boundary",
            "n_traces": 9,
            "pr_url": null,
            "failure_reason": "heal action timed out after 15m in customer repo runner",
            "last_trace_at": "2026-05-29T22:04:48+00:00",
            "is_recurrence": false,
            "created_at": "2026-05-27T08:15:30+00:00",
            "updated_at": "2026-05-31T13:09:41+00:00"
          }
        ]
      },
      {
        "id": "heals.get",
        "label": "Get heal card detail",
        "http": "GET",
        "path": "/v1/heals/{card_id}",
        "kind": "read",
        "danger": false,
        "summary": "Fetch one heal card with proposed fixes, LLM-enriched suggestion, evidence traces, and recurrence lineage.",
        "params": [
          {
            "name": "card_id",
            "loc": "path",
            "type": "string (uuid)",
            "required": true,
            "example": "hc_9d40ab",
            "desc": "Heal card id. Scoped to your projects; foreign cards return 404."
          }
        ],
        "cli": "veralith heals.get card_id=hc_9d40ab",
        "snippets": {
          "python": "import requests\n\ncard_id = \"hc_9d40ab\"\nresp = requests.get(\n    f\"https://api.veralithai.com/v1/heals/{card_id}\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n)\nresp.raise_for_status()\ncard = resp.json()\nprint(card[\"status\"], card[\"enriched\"][\"proposed_fix\"])",
          "node": "const cardId = \"hc_9d40ab\";\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/heals/${cardId}`,\n  { headers: { Authorization: \"Bearer sk_live_…\" } }\n);\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconst card = await resp.json();\nconsole.log(card.status, card.enriched?.proposed_fix);",
          "curl": "curl -s 'https://api.veralithai.com/v1/heals/hc_9d40ab' \\\n  -H 'Authorization: Bearer sk_live_…'"
        },
        "sampleResponse": {
          "id": "hc_9d40ab",
          "project_id": "proj_3f9c2a",
          "status": "pr_raised",
          "title": "Answers add SLA numbers not present in retrieved context",
          "suggestion_slug": "sla-hallucination-extra-ungrounded",
          "n_traces": 6,
          "pr_url": "https://github.com/acme/docs-rag/pull/218",
          "failure_reason": null,
          "last_trace_at": "2026-05-31T18:11:02+00:00",
          "is_recurrence": true,
          "created_at": "2026-05-30T11:20:00+00:00",
          "updated_at": "2026-06-01T07:55:14+00:00",
          "suggestion_description": "Answers add SLA numbers not present in retrieved context",
          "previous_card_id": "hc_41ff20",
          "recurrence": {
            "is_recurrence": true,
            "headline": "This failure came back after a previous fix was merged (merged 2026-05-18) — the earlier fix did not hold. Try a different approach.",
            "prior_attempts": 1,
            "previous_card_id": "hc_41ff20",
            "previous_status": "resolved",
            "previous_pr_url": "https://github.com/acme/docs-rag/pull/197",
            "previous_pr_accepted_at": "2026-05-18T16:40:09+00:00",
            "previous_failed_at": null,
            "previous_failure_reason": null,
            "previous_created_at": "2026-05-15T10:02:44+00:00",
            "previous_fix": "Add a post-generation guard that strips any numeric SLA claim absent from retrieved chunks."
          },
          "pr_raised_at": "2026-06-01T07:55:14+00:00",
          "pr_accepted_at": null,
          "failed_at": null,
          "failure_patch": null,
          "in_progress_started_at": "2026-06-01T07:31:50+00:00",
          "proposed_fixes": [
            {
              "title": "Constrain generation to retrieved SLA figures",
              "body": "Several answers cite '99.99% uptime' and '4-hour response SLA' that do not appear in any retrieved chunk. Add a faithfulness post-check that rejects numeric claims without a supporting chunk span.",
              "classification_confidence": "high",
              "matched_via": "embedding"
            },
            {
              "title": "Raise grounding threshold for numeric spans",
              "body": "Numeric tokens should require a higher grounding score before being emitted; gate on faithfulness < 0.6.",
              "classification_confidence": "medium",
              "matched_via": "slug"
            }
          ],
          "enriched": {
            "summary": "Model invents SLA percentages and response times not in retrieved context.",
            "root_cause": "The generation prompt does not constrain numeric claims to retrieved evidence, so the model fills SLA gaps from parametric memory.",
            "proposed_fix": "Add a post-generation verifier that extracts numeric claims (percentages, durations) from the answer and confirms each appears verbatim or as a paraphrase in a retrieved chunk. Drop or hedge unsupported numbers before returning. Tighten the system prompt to forbid SLA figures absent from context, and log the dropped claims for monitoring.",
            "confidence": "high",
            "evidence_summary": "All sampled traces classified extra-ungrounded (eu): the answer contained correct-sounding SLA numbers with no matching retrieved span.",
            "generated_at": "2026-06-01T07:33:12+00:00",
            "trace_count": 6
          },
          "evidence_traces": [
            {
              "id": "t_9af3c12b",
              "query": "What is the uptime guarantee on the enterprise plan?",
              "response": "The enterprise plan guarantees 99.99% uptime with a 4-hour incident response SLA.",
              "added_at": "2026-05-31T18:11:02+00:00",
              "failure_cell": "eu",
              "sufficiency_score": 0.72,
              "faithfulness_score": 0.31
            },
            {
              "id": "t_4be1d80a",
              "query": "How fast do you respond to a Sev-1 outage?",
              "response": "Sev-1 outages are acknowledged within 15 minutes and resolved within 4 hours per our SLA.",
              "added_at": "2026-05-31T16:48:20+00:00",
              "failure_cell": "eu",
              "sufficiency_score": 0.4,
              "faithfulness_score": 0.28
            }
          ]
        }
      },
      {
        "id": "heals.heal",
        "label": "Trigger heal",
        "http": "POST",
        "path": "/v1/heals/{card_id}/heal",
        "kind": "operate",
        "danger": true,
        "summary": "Move an open (or failed) card to in_progress and queue a heal action for Claude Code to pick up via MCP. Returns 202.",
        "params": [
          {
            "name": "card_id",
            "loc": "path",
            "type": "string (uuid)",
            "required": true,
            "example": "hc_7b21f4",
            "desc": "Heal card id. Must be in status open or failed, else 409."
          }
        ],
        "cli": "veralith heals.heal card_id=hc_7b21f4",
        "snippets": {
          "python": "import requests\n\ncard_id = \"hc_7b21f4\"\nresp = requests.post(\n    f\"https://api.veralithai.com/v1/heals/{card_id}/heal\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n)\nresp.raise_for_status()  # 202 Accepted\nprint(resp.json())  # {'id': ..., 'status': 'in_progress'}",
          "node": "const cardId = \"hc_7b21f4\";\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/heals/${cardId}/heal`,\n  { method: \"POST\", headers: { Authorization: \"Bearer sk_live_…\" } }\n);\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconsole.log(await resp.json());",
          "curl": "curl -s -X POST 'https://api.veralithai.com/v1/heals/hc_7b21f4/heal' \\\n  -H 'Authorization: Bearer sk_live_…'"
        },
        "sampleResponse": {
          "id": "hc_7b21f4",
          "status": "in_progress"
        }
      },
      {
        "id": "heals.accept",
        "label": "Accept PR",
        "http": "POST",
        "path": "/v1/heals/{card_id}/accept",
        "kind": "operate",
        "danger": true,
        "summary": "Accept the raised PR for a card; transitions pr_raised to resolved and stamps pr_accepted_at.",
        "params": [
          {
            "name": "card_id",
            "loc": "path",
            "type": "string (uuid)",
            "required": true,
            "example": "hc_9d40ab",
            "desc": "Heal card id. Must be in status pr_raised, else 409."
          }
        ],
        "cli": "veralith heals.accept card_id=hc_9d40ab",
        "snippets": {
          "python": "import requests\n\ncard_id = \"hc_9d40ab\"\nresp = requests.post(\n    f\"https://api.veralithai.com/v1/heals/{card_id}/accept\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n)\nresp.raise_for_status()\nprint(resp.json())  # {'id': ..., 'status': 'resolved', 'pr_url': ...}",
          "node": "const cardId = \"hc_9d40ab\";\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/heals/${cardId}/accept`,\n  { method: \"POST\", headers: { Authorization: \"Bearer sk_live_…\" } }\n);\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconsole.log(await resp.json());",
          "curl": "curl -s -X POST 'https://api.veralithai.com/v1/heals/hc_9d40ab/accept' \\\n  -H 'Authorization: Bearer sk_live_…'"
        },
        "sampleResponse": {
          "id": "hc_9d40ab",
          "status": "resolved",
          "pr_url": "https://github.com/acme/docs-rag/pull/218"
        }
      },
      {
        "id": "heals.retry",
        "label": "Retry failed heal",
        "http": "POST",
        "path": "/v1/heals/{card_id}/retry",
        "kind": "operate",
        "danger": true,
        "summary": "From a failed card: clear stale failure markers, move to in_progress, and queue a fresh heal action. Returns 202.",
        "params": [
          {
            "name": "card_id",
            "loc": "path",
            "type": "string (uuid)",
            "required": true,
            "example": "hc_c1e882",
            "desc": "Heal card id. Must be in status failed, else 409."
          }
        ],
        "cli": "veralith heals.retry card_id=hc_c1e882",
        "snippets": {
          "python": "import requests\n\ncard_id = \"hc_c1e882\"\nresp = requests.post(\n    f\"https://api.veralithai.com/v1/heals/{card_id}/retry\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n)\nresp.raise_for_status()  # 202 Accepted\nprint(resp.json())  # {'id': ..., 'status': 'in_progress'}",
          "node": "const cardId = \"hc_c1e882\";\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/heals/${cardId}/retry`,\n  { method: \"POST\", headers: { Authorization: \"Bearer sk_live_…\" } }\n);\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconsole.log(await resp.json());",
          "curl": "curl -s -X POST 'https://api.veralithai.com/v1/heals/hc_c1e882/retry' \\\n  -H 'Authorization: Bearer sk_live_…'"
        },
        "sampleResponse": {
          "id": "hc_c1e882",
          "status": "in_progress"
        }
      }
    ]
  },
  {
    "resource": "events",
    "methods": [
      {
        "id": "events.stream",
        "label": "Stream project events",
        "http": "GET",
        "path": "/v1/projects/{project_id}/events",
        "kind": "read",
        "danger": false,
        "summary": "Subscribe to a project's realtime Server-Sent-Events feed: trace_created / trace_evaluated / trace_failed and heal_card_created / heal_card_status_changed as they commit.",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_7Kd2xQ",
            "desc": "Target project id. Must be a project owned by the JWT user, or the project bound to the API key. Resolving an unknown/unauthorized project returns 404."
          },
          {
            "name": "token",
            "loc": "query",
            "type": "string",
            "required": false,
            "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...redacted",
            "desc": "Short-lived Supabase JWT for browser EventSource clients that cannot set headers. ONLY accepts JWTs — passing a long-lived API key (vk_live_… / sk_live_… prefix) here returns 400, since secrets in URLs leak into logs/history. Omit this when using the Authorization header."
          },
          {
            "name": "Authorization",
            "loc": "header",
            "type": "string",
            "required": false,
            "example": "Bearer sk_live_…redacted",
            "desc": "Bearer auth for non-browser clients: an API key (sk_live_…/vk_live_…) or a JWT. Required when ?token= is not supplied. One of (token, Authorization) must be present or the request returns 401."
          }
        ],
        "cli": "veralith events.stream project_id=proj_7Kd2xQ",
        "snippets": {
          "python": "import httpx\n\n# SSE stream — no SDK reader surface yet, so we stream the raw HTTP response.\nURL = \"https://api.veralithai.com/v1/projects/proj_7Kd2xQ/events\"\nHEADERS = {\n    \"Authorization\": \"Bearer sk_live_…redacted\",\n    \"Accept\": \"text/event-stream\",\n}\n\nwith httpx.stream(\"GET\", URL, headers=HEADERS, timeout=None) as resp:\n    resp.raise_for_status()\n    event_type, data = None, None\n    for line in resp.iter_lines():\n        if line.startswith(\"event:\"):\n            event_type = line[len(\"event:\"):].strip()\n        elif line.startswith(\"data:\"):\n            data = line[len(\"data:\"):].strip()\n        elif line == \"\" and event_type:          # blank line ends one event frame\n            print(event_type, data)\n            event_type, data = None, None\n        # lines beginning with ':' are comments (': connected', ': keepalive') — ignore",
          "node": "// SSE stream — no SDK reader surface yet, so we read the raw fetch body.\nconst URL = \"https://api.veralithai.com/v1/projects/proj_7Kd2xQ/events\";\n\nconst resp = await fetch(URL, {\n  headers: {\n    Authorization: \"Bearer sk_live_…redacted\",\n    Accept: \"text/event-stream\",\n  },\n});\nif (!resp.ok) throw new Error(`stream failed: ${resp.status}`);\n\nconst reader = resp.body.getReader();\nconst decoder = new TextDecoder();\nlet buf = \"\";\nfor (;;) {\n  const { value, done } = await reader.read();\n  if (done) break;\n  buf += decoder.decode(value, { stream: true });\n  let i;\n  while ((i = buf.indexOf(\"\\n\\n\")) !== -1) {     // each frame is terminated by a blank line\n    const frame = buf.slice(0, i);\n    buf = buf.slice(i + 2);\n    const evt = {};\n    for (const ln of frame.split(\"\\n\")) {\n      if (ln.startsWith(\"event:\")) evt.type = ln.slice(6).trim();\n      else if (ln.startsWith(\"data:\")) evt.data = JSON.parse(ln.slice(5).trim());\n      // ': connected' / ': keepalive' comment lines are ignored\n    }\n    if (evt.type) console.log(evt.type, evt.data);\n  }\n}",
          "curl": "curl -N \\\n  -H \"Authorization: Bearer sk_live_…redacted\" \\\n  -H \"Accept: text/event-stream\" \\\n  https://api.veralithai.com/v1/projects/proj_7Kd2xQ/events\n\n# -N disables curl buffering so each event prints as it arrives.\n# Browser EventSource alternative (JWT only, no API keys in the URL):\n#   new EventSource(\"https://api.veralithai.com/v1/projects/proj_7Kd2xQ/events?token=<supabase_jwt>\")"
        },
        "sampleResponse": [
          {
            "id": 4817,
            "event": "trace_created",
            "data": {
              "trace_id": "t_9af3c1d0e22b",
              "created_at": "2026-06-02T14:07:31.482190+00:00"
            },
            "ts": "2026-06-02T14:07:31.501733+00:00"
          },
          {
            "id": 4818,
            "event": "trace_evaluated",
            "data": {
              "trace_id": "t_9af3c1d0e22b",
              "failure_cell": "iu",
              "sufficiency_score": 0.4,
              "faithfulness_score": 0.62
            },
            "ts": "2026-06-02T14:07:34.918044+00:00"
          },
          {
            "id": 4819,
            "event": "heal_card_created",
            "data": {
              "heal_card_id": "hc_5b1e7740aa39",
              "suggestion_key_id": "sk_2c84f019d7b1",
              "is_recurrence": false
            },
            "ts": "2026-06-02T14:07:35.226310+00:00"
          },
          {
            "id": 4820,
            "event": "heal_card_status_changed",
            "data": {
              "heal_card_id": "hc_5b1e7740aa39",
              "status": "pr_open"
            },
            "ts": "2026-06-02T14:09:02.774915+00:00"
          }
        ]
      }
    ]
  },
  {
    "resource": "Account",
    "methods": [
      {
        "id": "projects.list",
        "label": "List projects",
        "http": "GET",
        "path": "/v1/projects",
        "kind": "read",
        "danger": false,
        "summary": "List the authenticated user's projects, each with its trace count and most-recent trace time.",
        "params": [],
        "cli": "veralith projects.list",
        "snippets": {
          "python": "import httpx\n\nresp = httpx.get(\n    \"https://api.veralithai.com/v1/projects\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n)\nresp.raise_for_status()\nprojects = resp.json()[\"projects\"]\nfor p in projects:\n    print(p[\"slug\"], p[\"trace_count\"])",
          "node": "const resp = await fetch(\"https://api.veralithai.com/v1/projects\", {\n  headers: { Authorization: \"Bearer sk_live_…\" },\n});\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconst { projects } = await resp.json();\nconsole.log(projects.map((p) => `${p.slug} (${p.trace_count})`));",
          "curl": "curl -s https://api.veralithai.com/v1/projects \\\n  -H \"Authorization: Bearer sk_live_…\""
        },
        "sampleResponse": {
          "projects": [
            {
              "id": "proj_8d2c1f4a",
              "user_id": "usr_a91e77b0",
              "name": "support-rag-prod",
              "slug": "support-rag-prod-3f9a2c",
              "created_at": "2026-06-01T09:14:22.481Z",
              "trace_count": 1842,
              "last_trace_at": "2026-06-02T07:51:03.220Z"
            },
            {
              "id": "proj_5b7e90d3",
              "user_id": "usr_a91e77b0",
              "name": "docs-assistant-staging",
              "slug": "docs-assistant-staging-7c1b04",
              "created_at": "2026-05-28T16:02:10.005Z",
              "trace_count": 263,
              "last_trace_at": "2026-06-01T22:09:44.118Z"
            }
          ]
        }
      },
      {
        "id": "apiKeys.list",
        "label": "List API keys",
        "http": "GET",
        "path": "/v1/projects/{project_id}/api-keys",
        "kind": "read",
        "danger": false,
        "summary": "List a project's API keys (prefix + last four only — the full secret is shown once at creation and never returned again).",
        "params": [
          {
            "name": "project_id",
            "loc": "path",
            "type": "string",
            "required": true,
            "example": "proj_8d2c1f4a",
            "desc": "Project id (UUID). Must be owned by the authenticated user, or 404."
          }
        ],
        "cli": "veralith apiKeys.list project_id=proj_8d2c1f4a",
        "snippets": {
          "python": "import httpx\n\nproject_id = \"proj_8d2c1f4a\"\nresp = httpx.get(\n    f\"https://api.veralithai.com/v1/projects/{project_id}/api-keys\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n)\nresp.raise_for_status()\nfor k in resp.json()[\"api_keys\"]:\n    state = \"revoked\" if k[\"revoked_at\"] else \"active\"\n    print(k[\"name\"], f\"{k['prefix']}…{k['last_four']}\", state)",
          "node": "const projectId = \"proj_8d2c1f4a\";\nconst resp = await fetch(\n  `https://api.veralithai.com/v1/projects/${projectId}/api-keys`,\n  { headers: { Authorization: \"Bearer sk_live_…\" } },\n);\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconst { api_keys } = await resp.json();\nconsole.log(api_keys.map((k) => `${k.name}: ${k.prefix}…${k.last_four}`));",
          "curl": "curl -s https://api.veralithai.com/v1/projects/proj_8d2c1f4a/api-keys \\\n  -H \"Authorization: Bearer sk_live_…\""
        },
        "sampleResponse": {
          "api_keys": [
            {
              "id": "ak_4f1c9a2e",
              "project_id": "proj_8d2c1f4a",
              "name": "prod-server",
              "prefix": "vk_live_9Qx",
              "last_four": "7b2a",
              "created_at": "2026-06-01T09:15:40.110Z",
              "last_used_at": "2026-06-02T07:51:03.190Z",
              "revoked_at": null
            },
            {
              "id": "ak_0b8d33c7",
              "project_id": "proj_8d2c1f4a",
              "name": "ci-smoke",
              "prefix": "vk_live_K3m",
              "last_four": "d10f",
              "created_at": "2026-05-30T11:42:08.730Z",
              "last_used_at": null,
              "revoked_at": "2026-06-01T18:20:55.004Z"
            }
          ]
        }
      },
      {
        "id": "me.get",
        "label": "Get current user",
        "http": "GET",
        "path": "/v1/me",
        "kind": "read",
        "danger": false,
        "summary": "Return the authenticated user's profile plus trial and subscription state. JWT only — API-key callers have no \"me\" because they are a project, not a user.",
        "params": [],
        "cli": "veralith me.get",
        "snippets": {
          "python": "import httpx\n\nresp = httpx.get(\n    \"https://api.veralithai.com/v1/me\",\n    headers={\"Authorization\": \"Bearer sk_live_…\"},\n)\nresp.raise_for_status()\nme = resp.json()\nprint(me[\"email\"], me[\"plan_tier\"], me[\"subscription_status\"])",
          "node": "const resp = await fetch(\"https://api.veralithai.com/v1/me\", {\n  headers: { Authorization: \"Bearer sk_live_…\" },\n});\nif (!resp.ok) throw new Error(`HTTP ${resp.status}`);\nconst me = await resp.json();\nconsole.log(me.email, me.plan_tier, me.subscription_status);",
          "curl": "curl -s https://api.veralithai.com/v1/me \\\n  -H \"Authorization: Bearer sk_live_…\""
        },
        "sampleResponse": {
          "id": "usr_a91e77b0",
          "email": "dev@acme-rag.io",
          "display_name": "Acme RAG",
          "trial_started_at": "2026-05-25T08:00:00.000Z",
          "trial_expires_at": "2026-06-08T08:00:00.000Z",
          "subscription_status": "trialing",
          "plan_tier": "trial",
          "created_at": "2026-05-25T08:00:00.000Z"
        }
      }
    ]
  }
];

export const SHELL_METHODS: ShellMethod[] = SHELL_CATALOG.flatMap((r) => r.methods);

export function methodById(id: string): ShellMethod | undefined {
  return SHELL_METHODS.find((m) => m.id === id);
}
