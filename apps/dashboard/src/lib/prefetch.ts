import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useProjects } from '../hooks/useProjects';

/* Warm every project page's primary query the moment you express intent to open a
   project (hover/focus/click on the Projects-home card) AND on shell entry, so
   the first page paints with data already in hand and tab navigation is instant.

   The keys below MUST match each page's query key exactly — the replicated
   window builders mirror the pages' (quantized / day-aligned) defaults. */

const DAY = 86_400_000;

// TodayOverview.periodWindow — Today / Yesterday / Last week. Day-aligned anchors
// keep the key stable across renders (mirrors routes/TodayOverview.tsx).
function periodWindow(period: 'today' | 'yesterday' | 'week') {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t = start.getTime();
  if (period === 'today') return { since: new Date(t).toISOString(), bucket: 'hour' as const };
  if (period === 'yesterday')
    return { since: new Date(t - DAY).toISOString(), until: new Date(t).toISOString(), bucket: 'hour' as const };
  return { since: new Date(t - 7 * DAY).toISOString(), bucket: 'day' as const };
}
// TodayOverview's ov24h — hour-floored 24h window (Overview latency panel).
function overview24h() {
  const since = new Date();
  since.setMinutes(0, 0, 0);
  return { since: new Date(since.getTime() - DAY).toISOString(), bucket: 'hour' as const };
}
// Trace Explorer default — sinceFor('24h'), 5-minute quantum.
function tracesSince24h() {
  const QUANTUM = 5 * 60_000;
  const now = Math.floor(Date.now() / QUANTUM) * QUANTUM;
  return new Date(now - DAY).toISOString();
}
// 24h window with a 1-minute quantum — used by BOTH Failure Cells
// (sinceForRange('24h')) and Analytics (sinceForWindow('24h')).
function since24hMinute() {
  const QUANTUM = 60_000;
  const now = Math.floor(Date.now() / QUANTUM) * QUANTUM;
  return new Date(now - DAY).toISOString();
}

/* Prefetch the data behind the first thing a user sees after opening a project:
   Overview (today/yesterday/last-week stats + insights + heals), the Trace
   Explorer list, Failure Cells, and Analytics. Inner pages (a single trace, a
   single heal) are intentionally left to load on demand. Safe to call repeatedly
   — react-query dedupes and respects `staleTime`. */
export function prefetchProjectData(qc: QueryClient, slug: string, projectId: string | null) {
  if (!slug) return;
  const staleTime = 60_000;
  const warm = <T,>(queryKey: unknown[], queryFn: () => Promise<T>) =>
    void qc.prefetchQuery({ queryKey, queryFn, staleTime });

  // ── Overview: today / yesterday / last-week stats ──────────────────────────
  const today = periodWindow('today');
  const yesterday = periodWindow('yesterday');
  const week = periodWindow('week');
  const h24 = overview24h();
  warm(['stats', slug, today], () => api.getStats(slug, today));
  warm(['stats', slug, yesterday], () => api.getStats(slug, yesterday));
  warm(['stats', slug, week], () => api.getStats(slug, week)); // also the Overview's stats7d
  warm(['stats', slug, h24], () => api.getStats(slug, h24)); // Overview latency 24h panel

  // Overview insights (knowledge-gap topics + cached "ver-advice" digest)
  const catParams = { since: week.since, limit: 8 };
  warm(['category-insights', slug, catParams], () => api.getCategoryInsights(slug, catParams));
  warm(['insight-summary', slug], () => api.getInsightSummary(slug));

  // ── Trace Explorer ─────────────────────────────────────────────────────────
  warm(['stats', slug, {}], () => api.getStats(slug, {})); // header stats (no params)
  const tq = { limit: 25, offset: 0, since: tracesSince24h(), sort: 'newest' as const };
  warm(['traces', slug, tq], () => api.listTraces(slug, tq)); // first page (24h · newest)

  // ── Failure Cells (24h) ────────────────────────────────────────────────────
  const cp = { since: since24hMinute(), bucket: 'hour' as const };
  warm(['cell-timeseries', slug, cp], () => api.getCellTimeseries(slug, cp));

  // ── Analytics (24h · stats + recent traces) ────────────────────────────────
  const anSince = since24hMinute();
  const anStats = { since: anSince, bucket: 'hour' as const };
  warm(['stats', slug, anStats], () => api.getStats(slug, anStats));
  const anTraces = { limit: 200, sort: 'newest' as const, since: anSince };
  warm(['traces', slug, anTraces], () => api.listTraces(slug, anTraces));

  // ── Heals list (both cache slots: Overview widget + Heals page) ─────────────
  if (projectId) {
    warm(['heals', projectId, 'all'], () => api.listHeals({ limit: 100 }));
    warm(['heals', projectId, 'overview'], () => api.listHeals({ limit: 100 }));
  }
}

/* Hook form: warm a project's data on shell entry (keeps tab navigation instant
   even if the user landed here without hovering a card first). */
export function usePrefetchProjectData(slug: string) {
  const qc = useQueryClient();
  const projects = useProjects();
  const projectId = projects.data?.projects.find((p) => p.slug === slug || p.id === slug)?.id ?? null;

  useEffect(() => {
    prefetchProjectData(qc, slug, projectId);
  }, [slug, projectId, qc]);
}
