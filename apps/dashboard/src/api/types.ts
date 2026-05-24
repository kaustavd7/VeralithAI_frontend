// Mirror of the Veralith v1 API contract.
// Phase 1 slice — extended in Phase 4 with trace/stats/calibration shapes.

export type FailureCell =
  | 'complete_grounded'
  | 'complete_ungrounded'
  | 'incomplete_grounded'
  | 'incomplete_ungrounded'
  | 'extra_grounded'
  | 'extra_ungrounded';

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

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
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
