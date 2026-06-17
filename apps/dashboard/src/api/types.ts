// Mirror of the Veralith v1 API contract.

export type FailureCell =
  | 'complete_grounded'
  | 'complete_ungrounded'
  | 'incomplete_grounded'
  | 'incomplete_ungrounded'
  | 'extra_grounded'
  | 'extra_ungrounded';

export type TraceStatus = 'queued' | 'evaluating' | 'evaluated' | 'failed';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  created_at: string;
  trace_count: number;
}

export interface ApiKey {
  id: string;
  project_id: string;
  prefix: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ApiKeyWithSecret extends ApiKey {
  secret: string;
}

export interface StatsTimeseriesPoint {
  bucket: string;
  count: number;
  ok: number;
  failed: number;
  avg_sufficiency: number;
  avg_faithfulness: number;
}

export interface StatsDeltas {
  total_traces_pct_24h: number;
  healthy_rate_pp_24h: number;
  avg_sufficiency_delta_24h: number;
  avg_faithfulness_delta_24h: number;
}

export interface StatsResponse {
  total_traces: number;
  by_cell: Record<FailureCell, number>;
  healthy_rate: number;
  avg_sufficiency: number;
  avg_faithfulness: number;
  total_cost_usd: number;
  timeseries: StatsTimeseriesPoint[];
  deltas: StatsDeltas;
}

// ---------------------------------------------------------------------------
// Failure-cell timeseries — GET /v1/projects/{id}/analytics/cells/timeseries
// Per-bucket counts for the 2×3 grounded × completeness taxonomy.
// ---------------------------------------------------------------------------
export interface CellTimeseriesPoint {
  bucket: string;
  cells: Record<FailureCell, number>;
}

export interface CellTimeseriesResponse {
  buckets: CellTimeseriesPoint[];
  totals: Record<FailureCell, number>;
  total: number;
}

export interface TraceListItem {
  // UUID per backend (per DEV2_HANDOFF.md §0). Display leading 8 chars.
  id: string;
  project_id: string;
  query: string;
  response_preview: string;
  status: TraceStatus;
  failure_cell: FailureCell | null;
  sufficiency_fraction: number | null;
  faithfulness_fraction: number | null;
  n_sub_questions: number;
  n_claims: number;
  created_at: string;
  evaluated_at: string | null;
  // Both fields are null in the current backend (no latency/cost storage yet).
  latency_ms_total: number | null;
  cost_usd: number | null;
}

export interface TracesResponse {
  traces: TraceListItem[];
  total: number;
  has_more: boolean;
}

export interface CalibrationResponse {
  threshold: number;
  n_successful_traces: number;
  percentile: number;
  using_fallback: boolean;
  fallback_value: number;
  computed_at: string;
}

// ---------------------------------------------------------------------------
// Trace detail — contract § 5.5  GET /v1/projects/{id}/traces/{trace_id}
// ---------------------------------------------------------------------------
export interface ContextChunk {
  rank: number;
  text: string;
  source: string | null;
  score: number | null;
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

export interface SufficiencyJudgment {
  sub_question_id: number;
  verdict: 'Y' | 'N';
  reasoning: string;
  supporting_chunk_ranks: number[];
}

export interface FaithfulnessJudgment {
  claim_id: number;
  verdict: 'Y' | 'N';
  reasoning: string;
  grounding_chunk_ranks: number[];
}

export interface CompletenessMapping {
  sub_question_id: number;
  covered_by_claim_id: number | null;
}

export interface CompletenessJudgment {
  overall: 'complete' | 'incomplete' | 'extra';
  reasoning: string;
  mappings: CompletenessMapping[];
  extra_claim_ids: number[];
}

export interface Diagnosis {
  failure_cell: FailureCell;
  sufficiency_level: 'high' | 'low';
  sufficiency_fraction: number;
  faithfulness_fraction: number;
  n_sub_questions: number;
  n_claims: number;
  n_uncovered_sub_questions: number;
  n_extra_claims: number;
}

export interface Suggestion {
  title: string;
  body: string;
  actions: string[];
  detailed_body: string | null;
  pattern_insights: string[];
}

// §13 pre-commitment — populated in Phase 0.2.5, empty in 0.2.
export interface HealSession {
  id: string;
  created_at: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  summary: string | null;
}

export interface TraceDetail {
  // UUID per backend.
  id: string;
  project_id: string;
  query: string;
  response: string;
  status: TraceStatus;
  created_at: string;
  evaluated_at: string | null;
  cost_usd: number | null;
  context_chunks: ContextChunk[];
  // Per DEV2_HANDOFF.md §0 these are not emitted by the current backend; mocks
  // still seed them so the Trace Detail page works end-to-end in mock mode.
  sub_questions: SubQuestion[];
  claims: Claim[];
  sufficiency: SufficiencyJudgment[];
  faithfulness: FaithfulnessJudgment[];
  completeness: CompletenessJudgment | null;
  diagnosis: Diagnosis | null;
  suggestion: Suggestion;
  latency_ms: Record<string, number>;
  errors: Record<string, string>;
  heal_sessions?: HealSession[];
}

export interface TraceDetailResponse {
  trace: TraceDetail;
}

export interface TracesQuery {
  limit?: number;
  offset?: number;
  cells?: FailureCell[];
  since?: string;
  until?: string;
  status?: TraceStatus;
  sort?: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Current user — contract §5.0  GET /v1/me
// ---------------------------------------------------------------------------
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';
export type PlanTier = 'trial' | 'pro';

export interface Me {
  id: string;
  email: string;
  display_name: string | null;
  trial_started_at: string;
  trial_expires_at: string;
  subscription_status: SubscriptionStatus;
  plan_tier: PlanTier;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Heals — contract §5.9  GET /v1/heals + GET /v1/heals/{id} + 6 actions
// ---------------------------------------------------------------------------
export type HealStatus =
  | 'open'
  | 'in_progress'
  | 'pr_raised'
  | 'resolved'
  | 'failed'
  | 'manually_fixed'
  | 'wont_fix'
  | 'superseded';

export interface HealCardSummary {
  id: string;
  project_id: string;
  status: HealStatus;
  title: string;
  suggestion_slug: string;
  n_traces: number;
  pr_url: string | null;
  failure_reason: string | null;
  last_trace_at: string;
  created_at: string;
  updated_at: string;
}

export interface ProposedFix {
  title: string;
  body: string;
  classification_confidence: 'high' | 'medium' | 'low';
  matched_via: 'llm' | 'heuristic' | string;
}

export interface HealEvidenceTrace {
  id: string;
  query: string;
  response: string;
  added_at: string;
  failure_cell: FailureCell;
  sufficiency_score: number;
  faithfulness_score: number;
}

export interface HealCardDetail extends HealCardSummary {
  suggestion_description: string;
  previous_card_id: string | null;
  pr_raised_at: string | null;
  pr_accepted_at: string | null;
  failed_at: string | null;
  failure_patch: string | null;
  in_progress_started_at: string | null;
  proposed_fixes: ProposedFix[];
  evidence_traces: HealEvidenceTrace[];
}

// Response shape for all 6 action endpoints.
export interface HealActionResponse {
  id: string;
  status: HealStatus;
  pr_url?: string | null;
}

export interface HealsListQuery {
  status_filter?: HealStatus;
  limit?: number;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
