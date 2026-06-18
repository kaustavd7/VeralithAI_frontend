import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useProjects } from '../hooks/useProjects';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

/* Subscribe to a project's server-sent-events stream so the dashboard updates
   LIVE when the backend finishes evaluating a trace or changes a heal — that's
   the "evaluation done" signal. Each event invalidates the relevant React Query
   caches; with placeholderData:keepPreviousData the visible page refreshes in
   place (no loader flash).

   Browser EventSource can't set headers, so the Supabase JWT is passed as
   ?token= (the backend accepts it there). A fresh token is fetched on every
   (re)connect so it survives expiry. */
export function useProjectEvents(slug: string | null) {
  const qc = useQueryClient();
  const projects = useProjects();
  const projectId = slug
    ? projects.data?.projects.find((p) => p.slug === slug || p.id === slug)?.id ?? null
    : null;

  useEffect(() => {
    if (!projectId || USE_MOCK) return;
    let es: EventSource | null = null;
    let stopped = false;
    let retry: number | undefined;

    const onTrace = () => {
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['traces'] });
      qc.invalidateQueries({ queryKey: ['cell-timeseries'] });
    };
    const onHeal = () => {
      qc.invalidateQueries({ queryKey: ['heals'] });
      qc.invalidateQueries({ queryKey: ['heal'] });
    };

    async function connect() {
      if (stopped) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        retry = window.setTimeout(connect, 3000);
        return;
      }
      const url = `${BASE_URL}/v1/projects/${projectId}/events?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      es.addEventListener('trace_created', onTrace);
      es.addEventListener('trace_evaluated', onTrace);
      es.addEventListener('trace_failed', onTrace);
      es.addEventListener('heal_card_created', onHeal);
      es.addEventListener('heal_card_status_changed', onHeal);
      es.onerror = () => {
        // Rebuild on drop (e.g. stale token) with a fresh token + small backoff.
        es?.close();
        es = null;
        if (!stopped) retry = window.setTimeout(connect, 3000);
      };
    }
    connect();

    return () => {
      stopped = true;
      if (retry) window.clearTimeout(retry);
      es?.close();
    };
  }, [projectId, qc]);
}
