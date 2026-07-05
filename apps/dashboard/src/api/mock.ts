import type {
  ApiKey,
  ApiKeyWithSecret,
  CalibrationResponse,
  CategoriesResponse,
  CellTimeseriesResponse,
  FailureCell,
  HealActionResponse,
  HealCardDetail,
  HealCardSummary,
  HealsListQuery,
  HealStatus,
  InsightSummaryResponse,
  Me,
  Project,
  StatsResponse,
  SystemHealthResponse,
  TraceDetail,
  TraceDetailResponse,
  TraceListItem,
  TracesQuery,
  TracesResponse,
} from './types';
import { ApiError } from './types';

const state = {
  projects: new Map<string, Project>(),
  keysByProject: new Map<string, ApiKeyWithSecret[]>(),
  heals: new Map<string, HealCardDetail>(),
};

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'untitled'
  );
}

function randomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = 'vk_live_';
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function delay(ms = 250) {
  await new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Seed traces — mirrors the wireframe's `sampleTraces` array verbatim.
// Used by getStats + listTraces so the page renders identical numbers to
// `planning/veralith-ai/project/Veralith Dashboard.html`.
// ---------------------------------------------------------------------------
type SeedTrace = {
  id: string;
  q: string;
  cell: TraceListItem['failure_cell'];
  s: number | null;
  f: number | null;
  claims: number;
  ms: number | null;
  cost: number | null;
  agoSeconds: number;
  evaluating?: boolean;
};

// UUID seeds — kept stable so the Trace Detail route key (`#9516a1e2-…`)
// resolves to the hand-authored detail fixture below. The first trace is
// always #9516a1e2-… (the wireframe's deep-dive); others mirror DEV2_HANDOFF.
export const SEED_DETAIL_ID = '9516a1e2-7c4d-4f1a-b8e3-2a1f6d90c001';

const SEED_TRACES: SeedTrace[] = [
  // Two in-flight (evaluating) rows at the top — no scores yet.
  { id: '7d2f9c41-0a58-4e6b-bc93-1f60d7a25e88', q: 'How does dollar-cost averaging interact with sequence-of-returns risk near retirement?', cell: null, s: null, f: null, claims: 0, ms: null, cost: null, agoSeconds: 8, evaluating: true },
  { id: 'a1c8e530-4b21-4d7f-9e84-30f5b6c91a72', q: 'Derive the effective annual rate from a nominal rate compounded continuously',          cell: null, s: null, f: null, claims: 0, ms: null, cost: null, agoSeconds: 24, evaluating: true },
  // Hand-authored deep-dive trace.
  { id: SEED_DETAIL_ID,                          q: 'Explain compounding frequency tradeoffs for monthly vs annual',                          cell: 'incomplete_ungrounded', s: 0.5,  f: 0.4,  claims: 5, ms: 11422, cost: 0.0062, agoSeconds: 120 },
  { id: 'b3d8f0a4-1e62-4c97-9a05-7f3c2d81e4b2', q: 'Tail risk in normal-distribution models — when does the assumption break down?',         cell: 'extra_ungrounded',      s: 0.25, f: 0.50, claims: 5, ms: 9412,  cost: 0.0055, agoSeconds: 840 },
  { id: 'c71a4e9d-8b30-4f25-ae18-5d9026fb13c4', q: 'Walk me through a Monte Carlo simulation of retirement spending under variable inflation', cell: 'incomplete_ungrounded', s: 0.28, f: 0.42, claims: 6, ms: 10100, cost: 0.0057, agoSeconds: 1320 },
  { id: 'd0e2c5b7-3a41-4d8e-b6f9-1c84a7e520d6', q: 'How would I model continuous compounding in Python with arbitrary contribution schedules?', cell: 'incomplete_grounded', s: 0.33, f: 1.00, claims: 4, ms: 7950,  cost: 0.0044, agoSeconds: 1860 },
  { id: 'e4f9a1c8-6d52-4b73-8e10-9a3b5c7d2f81', q: 'What is the Sortino ratio and how does it differ from Sharpe in practical use?',         cell: 'incomplete_grounded',   s: 0.45, f: 0.95, claims: 5, ms: 8400,  cost: 0.0047, agoSeconds: 2640 },
  { id: 'f28b6d04-9c13-4a85-bf27-3e016d4a9c53', q: 'Are floating-rate notes immune to duration risk? Explain with worked example',          cell: 'complete_ungrounded',   s: 0.50, f: 0.45, claims: 6, ms: 9128,  cost: 0.0051, agoSeconds: 3480 },
  { id: '0a7c3e91-2f84-4d16-95b8-6c2917f0a4e7', q: 'Define duration-matching for a pension liability and outline the rebalancing cadence', cell: 'incomplete_grounded',   s: 0.55, f: 1.00, claims: 8, ms: 10250, cost: 0.0058, agoSeconds: 3600 },
  { id: '1b9d4f72-5e03-4c28-a6f1-8d40b3927e15', q: 'What does APR vs APY mean? Give a worked example over 5 years',                         cell: 'complete_ungrounded',   s: 0.62, f: 0.67, claims: 6, ms: 9128,  cost: 0.0051, agoSeconds: 3900 },
  { id: '2c0e5a83-7f14-4d39-b720-9e51c4038f26', q: 'Compare yield-to-maturity and yield-to-call for callable bonds',                        cell: 'incomplete_grounded',   s: 0.66, f: 0.98, claims: 4, ms: 7340,  cost: 0.0041, agoSeconds: 4200 },
  { id: '3d1f6b94-8005-4e4a-c831-0f62d5149037', q: 'Why do central banks raise rates to fight inflation — describe the transmission channel', cell: 'incomplete_grounded', s: 0.66, f: 1.00, claims: 4, ms: 7400,  cost: 0.0042, agoSeconds: 4800 },
];

function seedToTrace(s: SeedTrace, projectId: string): TraceListItem {
  const created = new Date(Date.now() - s.agoSeconds * 1000).toISOString();
  return {
    id: s.id,
    project_id: projectId,
    query: s.q,
    response_preview: '',
    status: s.evaluating ? 'evaluating' : 'evaluated',
    failure_cell: s.cell,
    sufficiency_fraction: s.s,
    faithfulness_fraction: s.f,
    n_sub_questions: 0,
    n_claims: s.claims,
    created_at: created,
    evaluated_at: s.evaluating ? null : created,
    latency_ms_total: s.ms,
    cost_usd: s.cost,
  };
}

// Aggregate counts from the wireframe's distribution chart (1,247 traces / 24h).
const SEED_STATS: StatsResponse = {
  total_traces: 1247,
  by_cell: {
    complete_grounded: 1083,
    incomplete_grounded: 87,
    extra_grounded: 41,
    complete_ungrounded: 24,
    extra_ungrounded: 7,
    incomplete_ungrounded: 5,
  },
  healthy_rate: 0.869,
  avg_sufficiency: 0.94,
  avg_faithfulness: 0.97,
  total_cost_usd: 6.23,
  timeseries: [
    { bucket: '00', count: 34,  ok: 32,  failed: 2,  avg_sufficiency: 0.96, avg_faithfulness: 0.97 },
    { bucket: '02', count: 29,  ok: 28,  failed: 1,  avg_sufficiency: 0.95, avg_faithfulness: 0.98 },
    { bucket: '04', count: 22,  ok: 22,  failed: 0,  avg_sufficiency: 0.94, avg_faithfulness: 0.97 },
    { bucket: '06', count: 44,  ok: 41,  failed: 3,  avg_sufficiency: 0.93, avg_faithfulness: 0.97 },
    { bucket: '08', count: 77,  ok: 72,  failed: 5,  avg_sufficiency: 0.95, avg_faithfulness: 0.96 },
    { bucket: '10', count: 105, ok: 98,  failed: 7,  avg_sufficiency: 0.94, avg_faithfulness: 0.97 },
    { bucket: '12', count: 133, ok: 124, failed: 9,  avg_sufficiency: 0.92, avg_faithfulness: 0.98 },
    { bucket: '14', count: 153, ok: 142, failed: 11, avg_sufficiency: 0.91, avg_faithfulness: 0.97 },
    { bucket: '16', count: 170, ok: 156, failed: 14, avg_sufficiency: 0.89, avg_faithfulness: 0.96 },
    { bucket: '18', count: 140, ok: 132, failed: 8,  avg_sufficiency: 0.9,  avg_faithfulness: 0.94 },
    { bucket: '20', count: 100, ok: 96,  failed: 4,  avg_sufficiency: 0.92, avg_faithfulness: 0.96 },
    { bucket: '22', count: 63,  ok: 60,  failed: 3,  avg_sufficiency: 0.94, avg_faithfulness: 0.97 },
    { bucket: 'now', count: 43, ok: 42,  failed: 1,  avg_sufficiency: 0.93, avg_faithfulness: 0.96 },
  ],
  deltas: {
    total_traces_pct_24h: 14.3,
    healthy_rate_pp_24h: 1.2,
    avg_sufficiency_delta_24h: 0.0,
    avg_faithfulness_delta_24h: -0.02,
  },
};

// ---------------------------------------------------------------------------
// Seed trace detail — mirrors `Veralith Trace Detail.html` verbatim for #1247.
// Field-for-field with the contract; the wireframe's numbers, text, judge
// reasoning, latency breakdown, and chunk content are reproduced as-is.
// ---------------------------------------------------------------------------
function buildSeedTraceDetail(projectId: string, id: string = SEED_DETAIL_ID): TraceDetail {
  const created = new Date(Date.now() - 12_000).toISOString();
  return {
    id,
    project_id: projectId,
    query:
      'Explain compounding frequency tradeoffs for monthly vs annual, and how this changes the doubling time under the Rule of 72.',
    response: [
      'The Rule of 72 estimates doubling time by dividing 72 by the annual interest rate.',
      'At a 6% return, the formula gives roughly 12 years to double.',
      'Monthly compounding produces a doubling time of about 11.6 years at the same nominal rate.',
      'Banks generally prefer annual compounding because it reduces operational overhead.',
      'Daily compounding offers diminishing returns above 12 periods per year.',
    ].join(' '),
    status: 'evaluated',
    created_at: created,
    evaluated_at: created,
    cost_usd: 0.0062,
    context_chunks: [
      {
        rank: 0,
        text: 'The Rule of 72 is a mental shortcut for estimating how long an investment takes to double. Divide 72 by the annual rate of return to get the approximate number of years. For example, at a 6% annual return, doubling takes ~12 years.',
        source: 'compound_interest.md',
        score: 0.82,
      },
      {
        rank: 1,
        text: 'Interest is the price of money over time. Simple interest accrues linearly on the principal, while compound interest accrues on principal plus prior interest.',
        source: 'interest_basics.md',
        score: 0.54,
      },
      {
        rank: 2,
        text: 'Worked examples of the Rule of 72: at 4% it takes 18 years to double, at 6% about 12 years, at 9% about 8 years. The approximation drifts at very low or very high rates.',
        source: 'rule_of_72_examples.md',
        score: 0.49,
      },
      {
        rank: 3,
        text: 'Time value of money: a dollar today is worth more than a dollar tomorrow. Discount rates capture this preference numerically.',
        source: 'time_value_intro.md',
        score: 0.31,
      },
    ],
    sub_questions: [
      { id: 0, order_idx: 0, text: 'How does the Rule of 72 estimate doubling time?' },
      { id: 1, order_idx: 1, text: 'What are the tradeoffs of monthly vs annual compounding?' },
    ],
    claims: [
      { id: 0, order_idx: 0, text: 'The Rule of 72 estimates doubling time by dividing 72 by the annual interest rate.' },
      { id: 1, order_idx: 1, text: 'At a 6% return, the formula gives roughly 12 years to double.' },
      { id: 2, order_idx: 2, text: 'Monthly compounding produces a doubling time of about 11.6 years at the same nominal rate.' },
      { id: 3, order_idx: 3, text: 'Banks generally prefer annual compounding because it reduces operational overhead.' },
      { id: 4, order_idx: 4, text: 'Daily compounding offers diminishing returns above 12 periods per year.' },
    ],
    sufficiency: [
      {
        sub_question_id: 0,
        verdict: 'Y',
        reasoning: 'Directly defined in chunk #0 (similarity 0.82). Sufficient context to answer.',
        supporting_chunk_ranks: [0, 2],
      },
      {
        sub_question_id: 1,
        verdict: 'N',
        reasoning:
          'No retrieved chunk discusses compounding frequency tradeoffs. All chunks cover the Rule of 72 itself, not periodic compounding.',
        supporting_chunk_ranks: [],
      },
    ],
    faithfulness: [
      {
        claim_id: 0,
        verdict: 'Y',
        reasoning:
          'Stated almost verbatim in chunk #0: "Divide 72 by the rate of return…". Direct lift, no fabrication.',
        grounding_chunk_ranks: [0],
      },
      {
        claim_id: 1,
        verdict: 'Y',
        reasoning: 'Both chunks #0 and #2 include the 6% / 12-year worked example. Numerically grounded.',
        grounding_chunk_ranks: [0, 2],
      },
      {
        claim_id: 2,
        verdict: 'N',
        reasoning:
          'No retrieved chunk discusses monthly vs annual compounding outcomes. The 11.6-year figure has no source in retrieval — fabricated.',
        grounding_chunk_ranks: [],
      },
      {
        claim_id: 3,
        verdict: 'N',
        reasoning: 'Asserted without support. No chunk discusses bank preferences or operational considerations.',
        grounding_chunk_ranks: [],
      },
      {
        claim_id: 4,
        verdict: 'N',
        reasoning: 'Plausible-sounding finance lore, but invented. Not present in any retrieved context.',
        grounding_chunk_ranks: [],
      },
    ],
    completeness: {
      overall: 'incomplete',
      reasoning:
        'Q0 is fully covered by R0/R1. Q1 has no grounded coverage — R2, R3, R4 are ungrounded fabrications attempting to fill the gap.',
      mappings: [
        { sub_question_id: 0, covered_by_claim_id: 0 },
        { sub_question_id: 1, covered_by_claim_id: null },
      ],
      extra_claim_ids: [],
    },
    diagnosis: {
      failure_cell: 'incomplete_ungrounded',
      sufficiency_level: 'low',
      sufficiency_fraction: 0.5,
      faithfulness_fraction: 0.4,
      n_sub_questions: 2,
      n_claims: 5,
      n_uncovered_sub_questions: 1,
      n_extra_claims: 0,
    },
    suggestion: {
      title: 'Retrieval gap, plus the generator hallucinated to fill the gap',
      body:
        'Only 1 of 2 sub-questions had supporting context in retrieval. The generator answered both anyway — and the un-grounded half is where the fabricated claims live. Fixing retrieval will likely fix both metrics together.',
      actions: [
        'Inspect the retriever for queries about `compounding frequency` — the chunk-store appears to be missing coverage on monthly vs annual tradeoffs.',
        'Re-rank with `top_k = 8` (currently 4) on this query class and verify Q1 gets supporting context.',
        'Lower generator temperature to `0.2` until retrieval is patched — this reduces willingness to fabricate when context is thin.',
        'Consider a `refuse_when_insufficient` guardrail keyed off the Sufficiency judge\'s verdict.',
      ],
      detailed_body: null,
      pattern_insights: [],
    },
    latency_ms: {
      persist: 5.7,
      'decompose Q': 1842.3,
      'decompose R': 1923.5,
      'judge S': 1411.8,
      'judge F': 1872.9,
      'judge C': 1654.0,
    },
    errors: {},
    heal_sessions: [],
  };
}

// ---------------------------------------------------------------------------
// Seed projects — pre-populate the grid so a fresh demo isn't empty.
// `user_id` is stamped lazily on first listProjects() call because the mock's
// userId is the live Supabase auth id (dynamic), and listProjects filters on
// it. Mirrors the lazy ensureSeedHeals() pattern below.
// ---------------------------------------------------------------------------
type SeedProject = {
  id: string;
  name: string;
  slug: string;
  agoSeconds: number;
  trace_count: number;
};

const SEED_PROJECTS: SeedProject[] = [
  {
    id: 'p1a2b3c4-0001-4f1a-9e10-1a2b3c4d5e60',
    name: 'Acme RAG Assistant',
    slug: 'acme-rag-assistant',
    agoSeconds: 14 * 86_400,
    trace_count: 1247,
  },
  {
    id: 'p2b3c4d5-0002-4f1a-9e10-2b3c4d5e6f71',
    name: 'Support Copilot',
    slug: 'support-copilot',
    agoSeconds: 6 * 86_400,
    trace_count: 318,
  },
  {
    id: 'p3c4d5e6-0003-4f1a-9e10-3c4d5e6f7082',
    name: 'Docs Search Beta',
    slug: 'docs-search-beta',
    agoSeconds: 2 * 86_400,
    trace_count: 42,
  },
];

let seededProjects = false;
function ensureSeedProjects(userId: string): void {
  if (seededProjects) return;
  seededProjects = true;
  for (const s of SEED_PROJECTS) {
    const project: Project = {
      id: s.id,
      user_id: userId,
      name: s.name,
      slug: s.slug,
      created_at: new Date(Date.now() - s.agoSeconds * 1000).toISOString(),
      trace_count: s.trace_count,
    };
    state.projects.set(project.id, project);
  }
}

const SEED_CALIBRATION: CalibrationResponse = {
  threshold: 0.85,
  n_successful_traces: 1083,
  percentile: 10,
  using_fallback: false,
  fallback_value: 0.5,
  computed_at: new Date().toISOString(),
};

function findProject(projectIdOrSlug: string): Project | null {
  if (state.projects.has(projectIdOrSlug)) return state.projects.get(projectIdOrSlug)!;
  for (const p of state.projects.values()) if (p.slug === projectIdOrSlug) return p;
  return null;
}

export const mockApi = {
  async listProjects(userId: string): Promise<{ projects: Project[] }> {
    await delay();
    ensureSeedProjects(userId);
    return {
      projects: Array.from(state.projects.values()).filter((p) => p.user_id === userId),
    };
  },

  async createProject(
    userId: string,
    body: { name: string; slug?: string },
  ): Promise<{ project: Project }> {
    await delay();
    const name = body.name.trim();
    if (!name) {
      throw new ApiError('validation_error', 'Project name is required.', 400);
    }
    const slug = body.slug?.trim() || slugify(name);
    const taken = Array.from(state.projects.values()).some(
      (p) => p.user_id === userId && p.slug === slug,
    );
    if (taken) {
      throw new ApiError('conflict', `A project with slug "${slug}" already exists.`, 409);
    }
    const project: Project = {
      id: crypto.randomUUID(),
      user_id: userId,
      name,
      slug,
      created_at: new Date().toISOString(),
      trace_count: 0,
    };
    state.projects.set(project.id, project);
    return { project };
  },

  async createApiKey(
    projectId: string,
    body: { name?: string } = {},
  ): Promise<{ api_key: ApiKeyWithSecret }> {
    await delay();
    if (!state.projects.has(projectId)) {
      throw new ApiError('not_found', 'Project not found.', 404);
    }
    const secret = randomSecret();
    const apiKey: ApiKeyWithSecret = {
      id: crypto.randomUUID(),
      project_id: projectId,
      prefix: secret.slice(0, 16) + '...',
      name: body.name?.trim() || 'default',
      created_at: new Date().toISOString(),
      last_used_at: null,
      revoked_at: null,
      secret,
    };
    const list = state.keysByProject.get(projectId) ?? [];
    list.push(apiKey);
    state.keysByProject.set(projectId, list);
    return { api_key: apiKey };
  },

  async listApiKeys(projectIdOrSlug: string): Promise<{ api_keys: ApiKey[] }> {
    await delay(120);
    const project = findProject(projectIdOrSlug);
    const pid = project?.id ?? projectIdOrSlug;
    const list = state.keysByProject.get(pid) ?? [];
    // Strip the secret field when listing — matches contract §5.2.
    const api_keys: ApiKey[] = list.map((k) => {
      const { secret: _secret, ...rest } = k;
      return rest;
    });
    return { api_keys };
  },

  async getStats(
    _projectIdOrSlug: string,
    _q: { since?: string; until?: string; bucket?: 'hour' | 'day' } = {},
  ): Promise<StatsResponse> {
    await delay(180);
    // Mock ignores window params — every panel sees the same seed series.
    // Real backend filters via ?since/?until/?bucket. We enrich the seed with
    // latency + completeness so the Overview grid renders in mock mode.
    const n = SEED_STATS.timeseries.length;
    const timeseries = SEED_STATS.timeseries.map((b, i) => {
      const bump = Math.sin((i / Math.max(1, n - 1)) * Math.PI); // afternoon peak
      return {
        ...b,
        rag_latency_p50_ms: Math.round((0.8 + 0.7 * bump) * 1000),
        rag_latency_p95_ms: Math.round((1.4 + 1.8 * bump) * 1000),
        completeness_rate: Math.round((0.92 - 0.08 * bump) * 1000) / 1000,
      };
    });
    return {
      ...SEED_STATS,
      completeness_rate: 0.89,
      connection_state: 'live',
      sdk_version: '0.2.1',
      rag_latency_ms: { p50: 1100, p90: 2400, p95: 2900, p99: 3300, sample_size: SEED_STATS.total_traces },
      timeseries,
      deltas: { ...SEED_STATS.deltas, completeness_rate_pp_24h: -0.03 },
    };
  },

  async listTraces(projectIdOrSlug: string, q: TracesQuery = {}): Promise<TracesResponse> {
    await delay(180);
    const project = findProject(projectIdOrSlug);
    const pid = project?.id ?? projectIdOrSlug;
    let traces = SEED_TRACES.map((s) => seedToTrace(s, pid));
    if (q.cells && q.cells.length > 0) {
      const set = new Set(q.cells);
      traces = traces.filter((t) => t.failure_cell && set.has(t.failure_cell));
    }
    if (q.status) traces = traces.filter((t) => t.status === q.status);
    const total = traces.length;
    const offset = q.offset ?? 0;
    const limit = q.limit ?? 50;
    const page = traces.slice(offset, offset + limit);
    return { traces: page, total, has_more: offset + page.length < total };
  },

  async getCalibration(_projectIdOrSlug: string): Promise<CalibrationResponse> {
    await delay(120);
    return SEED_CALIBRATION;
  },

  // Failure-cell timeseries — demo series (healthy-dominated, failures sprinkled)
  // so the Failure Cells tab has something to show in mock mode.
  async getCellTimeseries(
    _projectIdOrSlug: string,
    q: { since?: string; until?: string; bucket?: 'hour' | 'day' } = {},
  ): Promise<CellTimeseriesResponse> {
    await delay(150);
    const byDay = q.bucket === 'day';
    const stepMs = byDay ? 86_400_000 : 3_600_000;
    const n = byDay ? 14 : 24;
    const now = Date.now();
    const CELLS: FailureCell[] = [
      'complete_grounded',
      'incomplete_grounded',
      'extra_grounded',
      'complete_ungrounded',
      'extra_ungrounded',
      'incomplete_ungrounded',
    ];
    const totals: Record<FailureCell, number> = {
      complete_grounded: 0,
      incomplete_grounded: 0,
      extra_grounded: 0,
      complete_ungrounded: 0,
      extra_ungrounded: 0,
      incomplete_ungrounded: 0,
    };
    const buckets = [];
    const scale = byDay ? 12 : 1;
    for (let i = n - 1; i >= 0; i--) {
      const cells: Record<FailureCell, number> = {
        complete_grounded: (30 + Math.round(Math.random() * 40)) * scale,
        incomplete_grounded: (2 + Math.round(Math.random() * 5)) * scale,
        extra_grounded: (1 + Math.round(Math.random() * 3)) * scale,
        complete_ungrounded: Math.round(Math.random() * 3) * scale,
        extra_ungrounded: Math.round(Math.random() * 2) * scale,
        incomplete_ungrounded: Math.round(Math.random() * 2) * scale,
      };
      for (const c of CELLS) totals[c] += cells[c];
      buckets.push({ bucket: new Date(now - i * stepMs).toISOString(), cells });
    }
    const total = CELLS.reduce((s, c) => s + totals[c], 0);
    return { buckets, totals, total };
  },

  async getTrace(
    projectIdOrSlug: string,
    traceId: string,
  ): Promise<TraceDetailResponse> {
    await delay(200);
    const project = findProject(projectIdOrSlug);
    const pid = project?.id ?? projectIdOrSlug;
    // Hand-authored seed lives at SEED_DETAIL_ID. Any other UUID falls back
    // to the same fixture with the id rewritten so the page is reachable.
    return { trace: buildSeedTraceDetail(pid, traceId) };
  },

  // -------------------------------------------------------------------------
  // §5.0 GET /v1/me — mock returns a trialing user 14 days out.
  // -------------------------------------------------------------------------
  async getMe(userId: string): Promise<Me> {
    await delay(80);
    const now = Date.now();
    const trialStart = new Date(now - 2 * 86400_000).toISOString();
    const trialEnd = new Date(now + 12 * 86400_000).toISOString();
    return {
      id: userId,
      email: 'you@veralith.local',
      display_name: null,
      trial_started_at: trialStart,
      trial_expires_at: trialEnd,
      subscription_status: 'trialing',
      plan_tier: 'trial',
      created_at: trialStart,
    };
  },

  // -------------------------------------------------------------------------
  // §5.1 DELETE /v1/projects/{id}
  // -------------------------------------------------------------------------
  async deleteProject(projectId: string): Promise<void> {
    await delay(120);
    if (!state.projects.has(projectId)) {
      throw new ApiError('not_found', 'Project not found.', 404);
    }
    state.projects.delete(projectId);
    state.keysByProject.delete(projectId);
  },

  // -------------------------------------------------------------------------
  // §5.2 DELETE /v1/projects/{id}/api-keys/{key_id}
  // -------------------------------------------------------------------------
  async deleteApiKey(projectId: string, keyId: string): Promise<void> {
    await delay(100);
    const list = state.keysByProject.get(projectId);
    if (!list) throw new ApiError('not_found', 'Project not found.', 404);
    const key = list.find((k) => k.id === keyId);
    if (!key) throw new ApiError('not_found', 'API key not found.', 404);
    key.revoked_at = new Date().toISOString();
  },

  // -------------------------------------------------------------------------
  // §5.9 Heals — seed 2 sample cards on first call so the UI has data.
  // -------------------------------------------------------------------------
  async listHeals(q: HealsListQuery = {}): Promise<HealCardSummary[]> {
    await delay(150);
    ensureSeedHeals();
    let cards = Array.from(state.heals.values());
    if (q.status_filter) cards = cards.filter((c) => c.status === q.status_filter);
    cards.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const limit = q.limit ?? 50;
    return cards.slice(0, limit).map(toSummary);
  },

  async getHeal(healId: string): Promise<HealCardDetail> {
    await delay(120);
    ensureSeedHeals();
    const card = state.heals.get(healId);
    if (!card) throw new ApiError('not_found', 'Heal card not found.', 404);
    return card;
  },

  async healAction(
    healId: string,
    action: 'heal' | 'accept' | 'decline' | 'retry' | 'dismiss-fixed' | 'dismiss-ignore' | 'reopen',
  ): Promise<HealActionResponse> {
    await delay(150);
    ensureSeedHeals();
    const card = state.heals.get(healId);
    if (!card) throw new ApiError('not_found', 'Heal card not found.', 404);
    const next = transition(card.status, action);
    if (!next) {
      throw new ApiError(
        'conflict',
        `Cannot '${action}' a card in status '${card.status}'.`,
        409,
      );
    }
    card.status = next;
    card.updated_at = new Date().toISOString();
    if (action === 'heal' || action === 'retry') {
      card.in_progress_started_at = card.updated_at;
      card.failure_reason = null;
      card.failed_at = null;
    }
    if (action === 'accept') card.pr_accepted_at = card.updated_at;
    return { id: card.id, status: card.status, pr_url: card.pr_url };
  },

  // -------------------------------------------------------------------------
  // Insights — knowledge-gap clusters + LLM "state of your RAG" digest.
  // -------------------------------------------------------------------------
  async getCategoryInsights(
    _projectIdOrSlug: string,
    _q: { since?: string; until?: string; limit?: number } = {},
  ): Promise<CategoriesResponse> {
    await delay(160);
    const seed: { desc: string; n: number; prev: number; cell: FailureCell }[] = [
      { desc: 'Billing & refunds', n: 42, prev: 36, cell: 'complete_ungrounded' },
      { desc: 'SSO / SAML setup', n: 34, prev: 31, cell: 'incomplete_grounded' },
      { desc: 'API rate limits', n: 30, prev: 25, cell: 'incomplete_ungrounded' },
      { desc: 'Data residency', n: 24, prev: 24, cell: 'complete_ungrounded' },
      { desc: 'Webhook retries', n: 20, prev: 22, cell: 'incomplete_grounded' },
      { desc: 'Export formats', n: 18, prev: 17, cell: 'extra_grounded' },
    ];
    const now = new Date();
    return {
      since: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
      until: now.toISOString(),
      total_categories: seed.length,
      categories: seed.map((c, i) => ({
        suggestion_key_id: `mock-key-${i}`,
        slug: slugify(c.desc),
        description: c.desc,
        trace_count: c.n,
        trace_count_prev: c.prev,
        trend_pct: c.prev ? Math.round(((c.n - c.prev) / c.prev) * 1000) / 10 : null,
        avg_sufficiency: 0.5,
        avg_faithfulness: 0.6,
        dominant_cell: c.cell,
        is_new: false,
        heal: null,
      })),
    };
  },

  async getInsightSummary(_projectIdOrSlug: string): Promise<InsightSummaryResponse> {
    await delay(160);
    return {
      summary:
        'Faithfulness is healthy — the model grounds well when it has the context. Your losses are completeness and retrieval gaps on a handful of topics (billing refunds, SSO/SAML setup). Fixing what gets retrieved will move the healthy rate more than any prompt change.',
      highlights: [
        'Close the billing-refund retrieval gap — largest single lift (42 failing queries).',
        'Audit completeness on long, multi-part questions.',
        'Watch rate-limit hallucinations — ungrounded answers rose this week.',
      ],
      based_on: { window_days: 7, total_traces: SEED_STATS.total_traces },
      generated_at: new Date().toISOString(),
    };
  },

  async getSystemHealth(_projectIdOrSlug: string): Promise<SystemHealthResponse> {
    await delay(140);
    return {
      status: 'operational',
      components: [
        { key: 'api', name: 'API', status: 'operational', detail: 'responding' },
        { key: 'database', name: 'Database', status: 'operational', detail: 'query ok' },
        { key: 'ingestion', name: 'Ingestion', status: 'operational', detail: '1,247 traces / 24h' },
        { key: 'evaluation', name: 'Evaluation (judges)', status: 'operational', detail: '1,180 evaluated / 24h' },
        { key: 'realtime', name: 'Realtime (SSE)', status: 'operational', detail: 'in-process' },
        { key: 'llm', name: 'LLM (OpenAI)', status: 'operational', detail: 'configured' },
      ],
      checked_at: new Date().toISOString(),
    };
  },
};

// ---------------------------------------------------------------------------
// Heals — helpers + seed fixtures
// ---------------------------------------------------------------------------
function toSummary(c: HealCardDetail): HealCardSummary {
  const {
    id,
    project_id,
    status,
    title,
    suggestion_slug,
    n_traces,
    pr_url,
    failure_reason,
    last_trace_at,
    created_at,
    updated_at,
  } = c;
  return {
    id,
    project_id,
    status,
    title,
    suggestion_slug,
    n_traces,
    pr_url,
    failure_reason,
    last_trace_at,
    created_at,
    updated_at,
  };
}

function transition(
  from: HealStatus,
  action: 'heal' | 'accept' | 'decline' | 'retry' | 'dismiss-fixed' | 'dismiss-ignore' | 'reopen',
): HealStatus | null {
  switch (action) {
    case 'heal':
      return from === 'open' || from === 'failed' ? 'in_progress' : null;
    case 'accept':
      return from === 'pr_raised' ? 'resolved' : null;
    case 'decline':
      return from === 'pr_raised' ? 'in_progress' : null;
    case 'retry':
      return from === 'failed' ? 'in_progress' : null;
    case 'dismiss-fixed':
      return from === 'open' || from === 'failed' || from === 'pr_raised'
        ? 'manually_fixed'
        : null;
    case 'dismiss-ignore':
      return from === 'open' || from === 'failed' || from === 'pr_raised' ? 'wont_fix' : null;
    case 'reopen':
      return from === 'wont_fix' || from === 'manually_fixed' ? 'open' : null;
  }
}

let seededHeals = false;
function ensureSeedHeals(): void {
  if (seededHeals) return;
  seededHeals = true;
  // Use the stable seed-project constant (NOT state.projects, which may not be
  // populated yet — listHeals resolves before listProjects seeds the map).
  const projectId = SEED_PROJECTS[0].id;
  const now = Date.now();
  const cards: HealCardDetail[] = [
    {
      id: '535a3728-mock-open',
      project_id: projectId,
      status: 'open',
      title: 'Retrieval misses queries about compounding frequency tradeoffs.',
      suggestion_slug: 'retrieval-coverage-compounding',
      n_traces: 3,
      pr_url: null,
      failure_reason: null,
      last_trace_at: new Date(now - 5 * 60_000).toISOString(),
      created_at: new Date(now - 2 * 3600_000).toISOString(),
      updated_at: new Date(now - 5 * 60_000).toISOString(),
      suggestion_description:
        'Multiple traces ask about monthly vs annual compounding tradeoffs. The retriever returns Rule-of-72 chunks but nothing on periodic compounding — leading the generator to fabricate filler claims.',
      previous_card_id: null,
      pr_raised_at: null,
      pr_accepted_at: null,
      failed_at: null,
      failure_patch: null,
      in_progress_started_at: null,
      proposed_fixes: [
        {
          title: 'Expand the chunk-store with periodic-compounding sources',
          body:
            'Add 3–5 explainer pages covering monthly vs annual vs continuous compounding to the index. Verify retrieval surfaces them with top_k=8.',
          classification_confidence: 'high',
          matched_via: 'llm',
        },
      ],
      evidence_traces: [
        {
          id: 'trace-1247',
          query: 'Explain compounding frequency tradeoffs for monthly vs annual.',
          response: 'Monthly compounding produces a doubling time of about 11.6 years…',
          added_at: new Date(now - 5 * 60_000).toISOString(),
          failure_cell: 'incomplete_ungrounded',
          sufficiency_score: 0.5,
          faithfulness_score: 0.4,
        },
      ],
    },
    {
      id: 'a1b2c3d4-mock-pr',
      project_id: projectId,
      status: 'pr_raised',
      title: 'Generator fabricates bank-policy claims when retrieval is thin.',
      suggestion_slug: 'guardrail-refuse-when-insufficient',
      n_traces: 7,
      pr_url: 'https://github.com/example/rag-app/pull/42',
      failure_reason: null,
      last_trace_at: new Date(now - 30 * 60_000).toISOString(),
      created_at: new Date(now - 6 * 3600_000).toISOString(),
      updated_at: new Date(now - 15 * 60_000).toISOString(),
      suggestion_description:
        'When the Sufficiency judge returns "low", the generator still produces grounded-sounding claims. Adding a refuse-when-insufficient guardrail in the prompt template prevents fabrication.',
      previous_card_id: null,
      pr_raised_at: new Date(now - 15 * 60_000).toISOString(),
      pr_accepted_at: null,
      failed_at: null,
      failure_patch: null,
      in_progress_started_at: new Date(now - 45 * 60_000).toISOString(),
      proposed_fixes: [
        {
          title: 'Add refuse-when-insufficient guardrail to the generator prompt',
          body:
            'Inject a system rule: "If sufficiency=low, respond with `I do not have enough context.` rather than answering."',
          classification_confidence: 'high',
          matched_via: 'llm',
        },
      ],
      evidence_traces: [],
    },
    {
      id: 'b2c3d4e5-mock-inprog',
      project_id: projectId,
      status: 'in_progress',
      title: 'Tax-bracket answers drift when the question spans multiple years.',
      suggestion_slug: 'normalize-tax-year-context',
      n_traces: 4,
      pr_url: null,
      failure_reason: null,
      last_trace_at: new Date(now - 12 * 60_000).toISOString(),
      created_at: new Date(now - 3 * 3600_000).toISOString(),
      updated_at: new Date(now - 2 * 60_000).toISOString(),
      suggestion_description:
        'When a query references two tax years, the retriever mixes brackets from different years and the generator blends them. Normalizing the year in the query-rewrite step should disambiguate retrieval.',
      previous_card_id: null,
      pr_raised_at: null,
      pr_accepted_at: null,
      failed_at: null,
      failure_patch: null,
      in_progress_started_at: new Date(now - 2 * 60_000).toISOString(),
      proposed_fixes: [
        {
          title: 'Add a year-normalization step to query rewriting',
          body: 'Detect explicit tax years and split multi-year queries into per-year sub-retrievals, then merge the results.',
          classification_confidence: 'medium',
          matched_via: 'llm',
        },
      ],
      evidence_traces: [
        {
          id: 'trace-2210',
          query: 'Compare the 2023 and 2024 federal brackets for $90k.',
          response: 'In 2023 the 22% bracket starts at…',
          added_at: new Date(now - 12 * 60_000).toISOString(),
          failure_cell: 'extra_ungrounded',
          sufficiency_score: 0.61,
          faithfulness_score: 0.48,
        },
      ],
    },
    {
      id: 'a7b8c9d0-mock-open2',
      project_id: projectId,
      status: 'open',
      title: 'Citations point to the wrong section of multi-part documents.',
      suggestion_slug: 'citation-section-anchors',
      n_traces: 4,
      pr_url: null,
      failure_reason: null,
      last_trace_at: new Date(now - 22 * 60_000).toISOString(),
      created_at: new Date(now - 4 * 3600_000).toISOString(),
      updated_at: new Date(now - 22 * 60_000).toISOString(),
      suggestion_description:
        'The generator cites the right document but the wrong heading. Attaching section anchors to chunk metadata should let it cite the exact subsection.',
      previous_card_id: null,
      pr_raised_at: null,
      pr_accepted_at: null,
      failed_at: null,
      failure_patch: null,
      in_progress_started_at: null,
      proposed_fixes: [
        {
          title: 'Attach section anchors to chunk metadata',
          body: 'Index each chunk with its heading path so citations resolve to the correct subsection.',
          classification_confidence: 'medium',
          matched_via: 'llm',
        },
      ],
      evidence_traces: [
        {
          id: 'trace-4120',
          query: 'Which section covers overdraft fees?',
          response: 'See Section 2…',
          added_at: new Date(now - 22 * 60_000).toISOString(),
          failure_cell: 'incomplete_grounded',
          sufficiency_score: 0.66,
          faithfulness_score: 0.72,
        },
      ],
    },
    {
      id: 'c3d4e5f6-mock-failed',
      project_id: projectId,
      status: 'failed',
      title: 'Date-math edge cases for leap years still hallucinate.',
      suggestion_slug: 'leap-year-date-math',
      n_traces: 5,
      pr_url: null,
      failure_reason:
        'The generated patch fixed the Feb-29 case but regressed two month-boundary traces, so CI was red and no PR was opened.',
      last_trace_at: new Date(now - 90 * 60_000).toISOString(),
      created_at: new Date(now - 26 * 3600_000).toISOString(),
      updated_at: new Date(now - 70 * 60_000).toISOString(),
      suggestion_description:
        'Queries that span a leap day get an off-by-one day count. Claude Code attempted a fix in the date util but it regressed adjacent cases.',
      previous_card_id: null,
      pr_raised_at: null,
      pr_accepted_at: null,
      failed_at: new Date(now - 70 * 60_000).toISOString(),
      failure_patch:
        '@@ -42,7 +42,7 @@ def days_between(a, b):\n-    return (b - a).days\n+    return (b - a).days + leap_adjust(a, b)\n@@ -50,0 +51,4 @@\n+def leap_adjust(a, b):\n+    # NOTE: regressed month-boundary cases\n+    return 1 if crosses_feb29(a, b) else 0',
      in_progress_started_at: new Date(now - 100 * 60_000).toISOString(),
      proposed_fixes: [
        {
          title: 'Use a date library instead of manual day math',
          body: 'Replace the hand-rolled day counter with the stdlib date diff to cover leap years and month boundaries.',
          classification_confidence: 'high',
          matched_via: 'heuristic',
        },
      ],
      evidence_traces: [
        {
          id: 'trace-3001',
          query: 'How many days from 2024-02-27 to 2024-03-02?',
          response: 'There are 6 days…',
          added_at: new Date(now - 90 * 60_000).toISOString(),
          failure_cell: 'complete_ungrounded',
          sufficiency_score: 0.7,
          faithfulness_score: 0.3,
        },
      ],
    },
    {
      id: 'd4e5f6a7-mock-resolved',
      project_id: projectId,
      status: 'resolved',
      title: 'Refuse-when-insufficient guardrail stopped fabricated fee claims.',
      suggestion_slug: 'guardrail-refuse-fees',
      n_traces: 9,
      pr_url: 'https://github.com/example/rag-app/pull/38',
      failure_reason: null,
      last_trace_at: new Date(now - 30 * 3600_000).toISOString(),
      created_at: new Date(now - 48 * 3600_000).toISOString(),
      updated_at: new Date(now - 20 * 3600_000).toISOString(),
      suggestion_description:
        'Adding an explicit refusal path when sufficiency is low eliminated fabricated account-fee numbers across nine traces.',
      previous_card_id: null,
      pr_raised_at: new Date(now - 24 * 3600_000).toISOString(),
      pr_accepted_at: new Date(now - 20 * 3600_000).toISOString(),
      failed_at: null,
      failure_patch: null,
      in_progress_started_at: new Date(now - 26 * 3600_000).toISOString(),
      proposed_fixes: [
        {
          title: 'Refuse when sufficiency = low',
          body: 'Return a safe refusal instead of answering when the sufficiency judge returns low.',
          classification_confidence: 'high',
          matched_via: 'llm',
        },
      ],
      evidence_traces: [],
    },
    {
      id: 'e5f6a7b8-mock-resolved2',
      project_id: projectId,
      status: 'resolved',
      title: 'Chunk-overlap fix recovered truncated policy answers.',
      suggestion_slug: 'increase-chunk-overlap',
      n_traces: 6,
      pr_url: 'https://github.com/example/rag-app/pull/31',
      failure_reason: null,
      last_trace_at: new Date(now - 4 * 24 * 3600_000).toISOString(),
      created_at: new Date(now - 5 * 24 * 3600_000).toISOString(),
      updated_at: new Date(now - 4 * 24 * 3600_000).toISOString(),
      suggestion_description:
        'Answers were truncated at chunk boundaries. Raising overlap from 0 to 80 tokens restored complete answers.',
      previous_card_id: null,
      pr_raised_at: new Date(now - (4 * 24 + 2) * 3600_000).toISOString(),
      pr_accepted_at: new Date(now - 4 * 24 * 3600_000).toISOString(),
      failed_at: null,
      failure_patch: null,
      in_progress_started_at: null,
      proposed_fixes: [],
      evidence_traces: [],
    },
    {
      id: 'f6a7b8c9-mock-manual',
      project_id: projectId,
      status: 'manually_fixed',
      title: 'Stale FX rates — fixed by repointing the rates source.',
      suggestion_slug: 'fx-rates-source',
      n_traces: 2,
      pr_url: null,
      failure_reason: null,
      last_trace_at: new Date(now - 8 * 24 * 3600_000).toISOString(),
      created_at: new Date(now - 9 * 24 * 3600_000).toISOString(),
      updated_at: new Date(now - 8 * 24 * 3600_000).toISOString(),
      suggestion_description:
        'Currency answers used a cached rates table. Marked fixed manually after the data team repointed the source feed.',
      previous_card_id: null,
      pr_raised_at: null,
      pr_accepted_at: null,
      failed_at: null,
      failure_patch: null,
      in_progress_started_at: null,
      proposed_fixes: [],
      evidence_traces: [],
    },
  ];
  // Seed the base (first) project, then clone the whole set onto every other
  // demo project so the heal board is populated whichever project you open.
  for (const c of cards) state.heals.set(c.id, c);
  for (const proj of SEED_PROJECTS.slice(1)) {
    for (const c of cards) {
      const clone: HealCardDetail = {
        ...c,
        id: `${proj.id.slice(0, 8)}-${c.id}`,
        project_id: proj.id,
      };
      state.heals.set(clone.id, clone);
    }
  }
}
