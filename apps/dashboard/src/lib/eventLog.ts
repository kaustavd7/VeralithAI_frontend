import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useProjects } from '../hooks/useProjects';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export interface LiveEvent {
  id: number;
  ts: string; // ISO
  type: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const MAX_EVENTS = 200;
const MAX_RETRIES = 6; // stop reconnecting after this many consecutive failures
const EVENT_TYPES = [
  'trace_created',
  'trace_evaluated',
  'trace_failed',
  'heal_card_created',
  'heal_card_status_changed',
] as const;

function shortId(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return s.length > 10 ? s.slice(0, 8) : s;
}

function describe(
  type: string,
  d: Record<string, unknown> | null,
): { level: LiveEvent['level']; message: string } {
  const id = shortId(d?.['trace_id'] ?? d?.['id'] ?? d?.['card_id'] ?? d?.['heal_card_id']);
  switch (type) {
    case 'trace_created':
      return { level: 'info', message: `ingest · trace ${id} accepted` };
    case 'trace_evaluated': {
      const cell = d?.['failure_cell'];
      return { level: 'info', message: `judge · trace ${id} evaluated${cell ? ' → ' + String(cell) : ''}` };
    }
    case 'trace_failed':
      return { level: 'error', message: `judge · trace ${id} evaluation failed` };
    case 'heal_card_created':
      return { level: 'info', message: `heal · card ${id} opened` };
    case 'heal_card_status_changed':
      return { level: 'info', message: `heal · card ${id} → ${d?.['status'] ?? '?'}` };
    default:
      return { level: 'info', message: `${type} ${id}`.trim() };
  }
}

/**
 * SSE-backed live event buffer for the Workbench Logs tab. Mirrors
 * lib/projectEvents.ts (same endpoint, ?token= auth, reconnect-with-backoff) but
 * instead of invalidating caches it keeps a capped, newest-first event list.
 *
 * Connects ONLY while `enabled` (the Logs tab is open) so we don't hold a second
 * EventSource for the whole session. No-ops in mock mode.
 */
export function useEventLog(slug: string | null, enabled: boolean) {
  const projects = useProjects();
  const projectId = slug
    ? projects.data?.projects.find((p) => p.slug === slug || p.id === slug)?.id ?? null
    : null;
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);
  const idRef = useRef(0);

  // Start each project with a clean buffer so one project's events never bleed
  // into another's when the global drawer stays open across navigation.
  useEffect(() => {
    setEvents([]);
    idRef.current = 0;
    setFailed(false);
  }, [projectId]);

  useEffect(() => {
    if (USE_MOCK || !enabled || !projectId) {
      setConnected(false);
      return;
    }
    let es: EventSource | null = null;
    let stopped = false;
    let attempts = 0;
    let retry: number | undefined;

    const onEvent = (type: string) => (ev: MessageEvent) => {
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = ev.data ? (JSON.parse(ev.data) as Record<string, unknown>) : null;
      } catch {
        parsed = null;
      }
      const { level, message } = describe(type, parsed);
      setEvents((prev) =>
        [{ id: idRef.current++, ts: new Date().toISOString(), type, level, message }, ...prev].slice(0, MAX_EVENTS),
      );
    };

    async function connect() {
      if (stopped) return;
      const { data } = await supabase.auth.getSession();
      // Re-check after the await: the tab may have unmounted while we waited,
      // in which case we must NOT open an EventSource that cleanup can't see.
      if (stopped) return;
      const token = data.session?.access_token;
      if (!token) {
        retry = window.setTimeout(connect, 3000);
        return;
      }
      const url = `${BASE_URL}/v1/projects/${projectId}/events?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      es.onopen = () => {
        if (stopped) return;
        attempts = 0;
        setConnected(true);
        setFailed(false);
      };
      for (const t of EVENT_TYPES) es.addEventListener(t, onEvent(t));
      es.onerror = () => {
        if (stopped) return;
        setConnected(false);
        es?.close();
        es = null;
        // EventSource can't expose the HTTP status, so bound retries: a terminal
        // failure (401/404/429) would otherwise reconnect forever every few s.
        if (attempts >= MAX_RETRIES) {
          setFailed(true);
          return;
        }
        const delay = Math.min(30_000, 3000 * 2 ** attempts); // exponential, capped
        attempts += 1;
        retry = window.setTimeout(connect, delay);
      };
    }
    connect();

    return () => {
      stopped = true;
      setConnected(false);
      if (retry) window.clearTimeout(retry);
      es?.close();
    };
  }, [projectId, enabled]);

  return { events, connected, failed };
}
