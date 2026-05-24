import { supabase } from '../lib/supabase';
import { mockApi } from './mock';
import { ApiError } from './types';
import type { ErrorEnvelope, Project, ApiKeyWithSecret } from './types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
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
    const body = (await res.json().catch(() => null)) as ErrorEnvelope | null;
    throw new ApiError(
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? `HTTP ${res.status}`,
      res.status,
      body?.error?.details,
    );
  }
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
};

export { ApiError };
