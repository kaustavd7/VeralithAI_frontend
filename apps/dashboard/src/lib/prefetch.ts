import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useProjects } from '../hooks/useProjects';

/* Warm every project page's primary query the moment you enter a project, so
   navigating between tabs is instant (data already cached) instead of a cold
   load each time. The keys below MUST match each page's query key exactly — the
   replicated `since`/window builders mirror the pages' (quantized) defaults. */

const DAY = 86_400_000;

// TodayOverview's periodWindow('today')
function overviewTodayWindow() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { since: new Date(start.getTime()).toISOString(), bucket: 'hour' as const };
}
// Trace Explorer default — sinceFor('24h'), 5-minute quantum
function tracesSince24h() {
  const QUANTUM = 5 * 60_000;
  const now = Math.floor(Date.now() / QUANTUM) * QUANTUM;
  return new Date(now - DAY).toISOString();
}
// Failure Cells default range '24h' — sinceForRange('24h'), 1-minute quantum
function cellsSince24h() {
  const QUANTUM = 60_000;
  const now = Math.floor(Date.now() / QUANTUM) * QUANTUM;
  return new Date(now - DAY).toISOString();
}

export function usePrefetchProjectData(slug: string) {
  const qc = useQueryClient();
  const projects = useProjects();
  const projectId = projects.data?.projects.find((p) => p.slug === slug || p.id === slug)?.id ?? null;

  useEffect(() => {
    if (!slug) return;
    const staleTime = 60_000;

    // Overview hero stats (TodayOverview · today window)
    const ov = overviewTodayWindow();
    qc.prefetchQuery({ queryKey: ['stats', slug, ov], queryFn: () => api.getStats(slug, ov), staleTime });

    // Trace Explorer header stats — useStats(slug) with no params
    qc.prefetchQuery({ queryKey: ['stats', slug, {}], queryFn: () => api.getStats(slug, {}), staleTime });

    // Trace Explorer first page (24h · newest)
    const tq = { limit: 25, offset: 0, since: tracesSince24h(), sort: 'newest' as const };
    qc.prefetchQuery({ queryKey: ['traces', slug, tq], queryFn: () => api.listTraces(slug, tq), staleTime });

    // Failure Cells (24h)
    const cp = { since: cellsSince24h(), bucket: 'hour' as const };
    qc.prefetchQuery({
      queryKey: ['cell-timeseries', slug, cp],
      queryFn: () => api.getCellTimeseries(slug, cp),
      staleTime,
    });

    // Heals list (key uses the resolved project id)
    if (projectId) {
      qc.prefetchQuery({
        queryKey: ['heals', projectId, 'all'],
        queryFn: () => api.listHeals({ limit: 100 }),
        staleTime,
      });
    }
  }, [slug, projectId, qc]);
}
