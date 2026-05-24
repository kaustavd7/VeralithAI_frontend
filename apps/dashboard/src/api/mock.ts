import type { Project, ApiKeyWithSecret } from './types';
import { ApiError } from './types';

const state = {
  projects: new Map<string, Project>(),
  keysByProject: new Map<string, ApiKeyWithSecret[]>(),
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

export const mockApi = {
  async listProjects(userId: string): Promise<{ projects: Project[] }> {
    await delay();
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
};
