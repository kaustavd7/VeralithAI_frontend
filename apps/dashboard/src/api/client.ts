import { supabase } from '../lib/supabase';
import { mockApi } from './mock';
import { ApiError } from './types';
import type {
  ApiKey,
  ApiKeyWithSecret,
  CalibrationResponse,
  CategoriesResponse,
  CellTimeseriesResponse,
  ErrorEnvelope,
  HealActionResponse,
  HealCardDetail,
  HealCardSummary,
  HealsListQuery,
  InsightSummaryResponse,
  Me,
  Project,
  StatsResponse,
  SystemHealthResponse,
  TraceDetailResponse,
  TracesQuery,
  TracesResponse,
} from './types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// When the session can't be refreshed (the JWT and its refresh token are dead),
// sign out and bounce to /login instead of letting requests fail with partial
// 401/500 errors across the page. The full-page redirect also clears the React
// Query cache, so no stale/partial data lingers behind the login screen.
let signingOut = false;
async function handleAuthExpiry(): Promise<void> {
  if (signingOut) return;
  signingOut = true;
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore — we're redirecting regardless */
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  // Proactively refresh a token that has expired (or expires within 30s) so we
  // never send a stale JWT — which the backend rejects. If the refresh fails the
  // session is truly dead, so sign the user out rather than firing doomed calls.
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 30_000) {
    try {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
    } catch {
      session = null;
    }
    if (!session) {
      await handleAuthExpiry();
      throw new ApiError('session_expired', 'Your session has expired. Please sign in again.', 401);
    }
  }
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    throw new ApiError('unauthenticated', 'You are not signed in.', 401);
  }
  return data.user.id;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    // Auth rejected mid-flight (expired/invalid JWT) → sign out + redirect.
    if (res.status === 401) {
      await handleAuthExpiry();
    }
    // FastAPI returns { detail: string } or { detail: [{ msg, ... }] } (validation);
    // legacy envelope returns { error: { code, message, details } }. Parse both.
    const body = (await res.json().catch(() => null)) as
      | (ErrorEnvelope & { detail?: unknown })
      | null;
    const detail = body?.detail;
    const detailMessage =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail
              .map((d) => (d as { msg?: unknown }).msg)
              .filter((m): m is string => typeof m === 'string' && Boolean(m))
              .join('; ')
          : null;
    const message = (detailMessage || null) ?? body?.error?.message ?? `HTTP ${res.status}`;
    const code = body?.error?.code ?? `http_${res.status}`;
    throw new ApiError(code, message, res.status, body?.error?.details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  async listProjects(): Promise<{ projects: Project[] }> {
    if (USE_MOCK) return mockApi.listProjects(await currentUserId());
    return request('/v1/projects');
  },

  async createProject(body: { name: string; slug?: string }): Promise<{ project: Project }> {
    if (USE_MOCK) return mockApi.createProject(await currentUserId(), body);
    return request('/v1/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async createApiKey(
    projectId: string,
    body: { name?: string } = {},
  ): Promise<{ api_key: ApiKeyWithSecret }> {
    if (USE_MOCK) return mockApi.createApiKey(projectId, body);
    return request(`/v1/projects/${projectId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async listApiKeys(projectId: string): Promise<{ api_keys: ApiKey[] }> {
    if (USE_MOCK) return mockApi.listApiKeys(projectId);
    return request(`/v1/projects/${projectId}/api-keys`);
  },

  async getStats(
    projectId: string,
    q: { since?: string; until?: string; bucket?: 'hour' | 'day' } = {},
  ): Promise<StatsResponse> {
    if (USE_MOCK) return mockApi.getStats(projectId, q);
    const params = new URLSearchParams();
    if (q.since) params.set('since', q.since);
    if (q.until) params.set('until', q.until);
    if (q.bucket) params.set('bucket', q.bucket);
    const qs = params.toString();
    return request(`/v1/projects/${projectId}/stats${qs ? `?${qs}` : ''}`);
  },

  async getCellTimeseries(
    projectId: string,
    q: { since?: string; until?: string; bucket?: 'hour' | 'day' } = {},
  ): Promise<CellTimeseriesResponse> {
    if (USE_MOCK) return mockApi.getCellTimeseries(projectId, q);
    const params = new URLSearchParams();
    if (q.since) params.set('since', q.since);
    if (q.until) params.set('until', q.until);
    if (q.bucket) params.set('bucket', q.bucket);
    const qs = params.toString();
    return request(`/v1/projects/${projectId}/analytics/cells/timeseries${qs ? `?${qs}` : ''}`);
  },

  async getCategoryInsights(
    projectId: string,
    q: { since?: string; until?: string; limit?: number } = {},
  ): Promise<CategoriesResponse> {
    if (USE_MOCK) return mockApi.getCategoryInsights(projectId, q);
    const params = new URLSearchParams();
    if (q.since) params.set('since', q.since);
    if (q.until) params.set('until', q.until);
    if (q.limit != null) params.set('limit', String(q.limit));
    const qs = params.toString();
    return request(`/v1/projects/${projectId}/insights/categories${qs ? `?${qs}` : ''}`);
  },

  async getInsightSummary(projectId: string): Promise<InsightSummaryResponse> {
    if (USE_MOCK) return mockApi.getInsightSummary(projectId);
    return request(`/v1/projects/${projectId}/insights/summary`);
  },

  async getSystemHealth(projectId: string): Promise<SystemHealthResponse> {
    if (USE_MOCK) return mockApi.getSystemHealth(projectId);
    return request(`/v1/projects/${projectId}/system/health`);
  },

  async listTraces(projectId: string, q: TracesQuery = {}): Promise<TracesResponse> {
    if (USE_MOCK) return mockApi.listTraces(projectId, q);
    const params = new URLSearchParams();
    if (q.limit != null) params.set('limit', String(q.limit));
    if (q.offset != null) params.set('offset', String(q.offset));
    if (q.cells && q.cells.length) params.set('cells', q.cells.join(','));
    if (q.since) params.set('since', q.since);
    if (q.until) params.set('until', q.until);
    if (q.status) params.set('status', q.status);
    if (q.sort) params.set('sort', q.sort);
    const qs = params.toString();
    return request(`/v1/projects/${projectId}/traces${qs ? `?${qs}` : ''}`);
  },

  async getCalibration(projectId: string): Promise<CalibrationResponse> {
    if (USE_MOCK) return mockApi.getCalibration(projectId);
    return request(`/v1/projects/${projectId}/calibration`);
  },

  async getTrace(projectId: string, traceId: string): Promise<TraceDetailResponse> {
    if (USE_MOCK) return mockApi.getTrace(projectId, traceId);
    return request(`/v1/projects/${projectId}/traces/${traceId}`);
  },

  // -------------------------------------------------------------------------
  // §5.0  GET /v1/me
  // -------------------------------------------------------------------------
  async getMe(): Promise<Me> {
    if (USE_MOCK) return mockApi.getMe(await currentUserId());
    return request('/v1/me');
  },

  // -------------------------------------------------------------------------
  // §5.1  DELETE /v1/projects/{id}
  // -------------------------------------------------------------------------
  async deleteProject(projectId: string): Promise<void> {
    if (USE_MOCK) return mockApi.deleteProject(projectId);
    await request<void>(`/v1/projects/${projectId}`, { method: 'DELETE' });
  },

  // -------------------------------------------------------------------------
  // §5.2  DELETE /v1/projects/{id}/api-keys/{key_id}
  // -------------------------------------------------------------------------
  async deleteApiKey(projectId: string, keyId: string): Promise<void> {
    if (USE_MOCK) return mockApi.deleteApiKey(projectId, keyId);
    await request<void>(`/v1/projects/${projectId}/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  },

  // -------------------------------------------------------------------------
  // §5.9  Heals — list + detail + 6 actions
  // -------------------------------------------------------------------------
  async listHeals(q: HealsListQuery = {}): Promise<HealCardSummary[]> {
    if (USE_MOCK) return mockApi.listHeals(q);
    const params = new URLSearchParams();
    if (q.status_filter) params.set('status_filter', q.status_filter);
    if (q.limit != null) params.set('limit', String(q.limit));
    const qs = params.toString();
    return request(`/v1/heals${qs ? `?${qs}` : ''}`);
  },

  async getHeal(healId: string): Promise<HealCardDetail> {
    if (USE_MOCK) return mockApi.getHeal(healId);
    return request(`/v1/heals/${healId}`);
  },

  async healAction(
    healId: string,
    action: 'heal' | 'accept' | 'decline' | 'retry' | 'dismiss-fixed' | 'dismiss-ignore',
  ): Promise<HealActionResponse> {
    if (USE_MOCK) return mockApi.healAction(healId, action);
    return request(`/v1/heals/${healId}/${action}`, { method: 'POST' });
  },

  // Bulk-accept every pr_raised card in a project → resolved (after a combined
  // "Heal all" PR merges).
  async acceptAllHeals(projectId: string): Promise<{ resolved: number }> {
    if (USE_MOCK) return { resolved: 0 };
    return request(`/v1/heals/accept-all?project_id=${encodeURIComponent(projectId)}`, { method: 'POST' });
  },
};

export { ApiError };
