import type { QueryClient } from '@tanstack/react-query';
import type { HealCardSummary, Project, StatsResponse, TraceDetailResponse } from '../api/types';

export interface LithContext {
  page: string;
  slug: string;
  projectId: string;
  facts: Record<string, unknown>;
  /** True when there's something specific worth commenting on (beyond a page name). */
  hasData: boolean;
  /** Changes only when the commentable context meaningfully changes. */
  signature: string;
}

// Pick the most representative cached stats entry for a project (pages use a few
// different windows; the one with the most traces is the richest to talk about).
function freshestStats(qc: QueryClient, slug: string): StatsResponse | undefined {
  let best: StatsResponse | undefined;
  for (const [, data] of qc.getQueriesData<StatsResponse>({ queryKey: ['stats', slug] })) {
    if (!data) continue;
    if (!best || (data.total_traces ?? 0) >= (best.total_traces ?? 0)) best = data;
  }
  return best;
}

function topFailureCell(byCell: Record<string, number> | undefined): string | null {
  if (!byCell) return null;
  let top: string | null = null;
  let max = 0;
  for (const [cell, n] of Object.entries(byCell)) {
    if (cell === 'complete_grounded') continue; // the healthy cell isn't a "failure"
    if ((n ?? 0) > max) {
      max = n ?? 0;
      top = cell;
    }
  }
  return max > 0 ? top : null;
}

/**
 * Build Lith's "view" of the current page from the React Query cache — i.e. what
 * the page has ALREADY loaded. Pure + read-only: never triggers a fetch, so the
 * global mascot only ever comments on data the user is actually looking at.
 */
export function buildLithContext(qc: QueryClient, pathname: string, projects: Project[]): LithContext {
  const m = pathname.match(/^\/projects\/([^/]+)(?:\/(.*))?$/);
  const slug = m?.[1] ?? '';
  const rest = m?.[2] ?? '';

  let page = 'dashboard';
  let traceId = '';
  if (!slug) {
    page = pathname.startsWith('/settings')
      ? 'settings'
      : pathname.startsWith('/onboarding')
        ? 'onboarding'
        : pathname.startsWith('/projects')
          ? 'projects'
          : 'dashboard';
  } else if (rest === '') page = 'overview';
  else if (/^traces\/[^/]+$/.test(rest)) {
    page = 'trace';
    traceId = rest.split('/')[1];
  } else if (rest === 'traces') page = 'traces';
  else if (rest === 'analytics/cells') page = 'cells';
  else if (rest === 'analytics') page = 'analytics';
  else if (rest === 'heals') page = 'heals';
  else if (/^heals\/[^/]+$/.test(rest)) page = 'heal';
  else page = 'project';

  // Resolve ONLY when the route carries a slug — no projects[0] fallback, so
  // slug-less pages (settings/onboarding/projects-list) don't mis-attribute a
  // remark (and its gpt-4o-mini cost) to an arbitrary project.
  const proj = slug ? projects.find((p) => p.slug === slug || p.id === slug) : undefined;
  const projectId = proj?.id ?? '';
  const facts: Record<string, unknown> = {};
  if (proj?.name) facts.project = proj.name;

  if (page === 'trace' && traceId) {
    const t = qc.getQueryData<TraceDetailResponse>(['trace', slug, traceId])?.trace;
    if (t) {
      facts.trace_status = t.status;
      if (t.query) facts.query = t.query.slice(0, 160);
      if (t.diagnosis) {
        facts.failure_cell = t.diagnosis.failure_cell;
        facts.sufficiency = t.diagnosis.sufficiency_fraction;
        facts.faithfulness = t.diagnosis.faithfulness_fraction;
      }
      if (t.suggestion?.title) facts.suggestion = t.suggestion.title;
    }
  } else if (slug) {
    const s = freshestStats(qc, slug);
    // Only when there are actually traces — a 0-trace project has null metrics
    // and nothing for Lith to say, so we leave facts empty (hasData stays false).
    if (s && (s.total_traces ?? 0) > 0) {
      facts.total_traces = s.total_traces;
      if (s.healthy_rate != null) facts.healthy_rate = s.healthy_rate;
      if (s.completeness_rate != null) facts.completeness_rate = s.completeness_rate;
      if (s.deltas?.healthy_rate_pp_24h != null) facts.healthy_delta_pp = s.deltas.healthy_rate_pp_24h;
      const tc = topFailureCell(s.by_cell);
      if (tc) facts.top_failure_cell = tc;
    }
  }

  if (page === 'heals' || page === 'heal') {
    let cards: HealCardSummary[] | undefined;
    for (const [, data] of qc.getQueriesData<HealCardSummary[]>({ queryKey: ['heals'] })) {
      if (Array.isArray(data) && (!cards || data.length > cards.length)) cards = data;
    }
    if (cards) {
      const scoped = cards.filter((c) => !projectId || c.project_id === projectId);
      facts.heal_total = scoped.length;
      facts.heal_open = scoped.filter((c) => c.status === 'open').length;
      facts.heal_pr_raised = scoped.filter((c) => c.status === 'pr_raised').length;
    }
  }

  const keyFactCount = Object.keys(facts).length - (facts.project ? 1 : 0);
  const signature = JSON.stringify({
    page,
    slug,
    traceId,
    hr: typeof facts.healthy_rate === 'number' ? Math.round((facts.healthy_rate as number) * 20) : null,
    tt: facts.total_traces ?? null,
    cell: facts.failure_cell ?? facts.top_failure_cell ?? null,
    heals: facts.heal_total ?? null,
  });

  return { page, slug, projectId, facts, hasData: keyFactCount > 0, signature };
}
