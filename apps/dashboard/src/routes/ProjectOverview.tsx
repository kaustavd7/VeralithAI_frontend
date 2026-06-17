/* ============================================================================
   ⚠ UNROUTED — this page is NOT mounted in App.tsx. The live "/projects/:slug"
   overview route renders routes/TodayOverview.tsx (demo data). This component is
   kept ON PURPOSE: it holds the real-API wiring (useStats / useTraces /
   useApiKeys + revoke) for when Overview is moved onto live data. Do not delete;
   when wiring the real Overview, merge TodayOverview's visual treatment onto this
   component's data hooks and route it here, then retire the demo. (See the
   consistency-audit openQuestion on ProjectOverview vs TodayOverview.)
   ============================================================================ */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import {
  useApiKeys,
  useStats,
  useTraces,
} from '../hooks/useOverviewData';
import { useProjects } from '../hooks/useProjects';
import { api } from '../api/client';
import type { ApiKey, StatsResponse, TraceListItem, Project } from '../api/types';

/* ─────────────────────────────────────────────────────────────
   Catmull-Rom → cubic-bezier sparkline (ported from wireframe).
   ─────────────────────────────────────────────────────────── */

function smooth(points: [number, number][], tension = 0.18): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function Sparkline({
  values,
  color = 'var(--po-fg-3)',
  fill,
  width = 140,
  height = 22,
  dot = false,
}: {
  values: number[];
  color?: string;
  fill?: string;
  width?: number;
  height?: number;
  dot?: boolean;
}) {
  if (values.length === 0) return null;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts: [number, number][] = values.map((v, i) => [
    pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2),
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  const linePath = smooth(pts);
  const areaPath = fill ? linePath + ` L ${pts[pts.length - 1][0]} ${height} L ${pts[0][0]} ${height} Z` : null;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {areaPath && <path d={areaPath} fill={fill} />}
      <path d={linePath} stroke={color} strokeWidth="1.4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {dot && last && <circle cx={last[0]} cy={last[1]} r="1.8" fill={color} />}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   State derivation — driven by API data only.
   ─────────────────────────────────────────────────────────── */

type ConnState = 'live' | 'idle' | 'never';

function deriveConnState(stats: StatsResponse | undefined, lastTrace: TraceListItem | undefined): ConnState {
  if (!stats || stats.total_traces === 0) return 'never';
  if (!lastTrace) return 'idle';
  const last = Date.parse(lastTrace.created_at);
  if (Number.isNaN(last)) return 'idle';
  const ageSec = (Date.now() - last) / 1000;
  return ageSec < 300 ? 'live' : 'idle';
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function shortDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────
   Hero
   ─────────────────────────────────────────────────────────── */

function ProjectHero({
  project,
  keyPrefix,
  state,
}: {
  project: Project;
  keyPrefix: string | null;
  state: ConnState;
}) {
  const dotClass =
    state === 'live' ? 'po-dot-live' : state === 'idle' ? 'po-dot-idle' : 'po-dot-grey';
  const dotLabel =
    state === 'live'
      ? 'Receiving traces'
      : state === 'idle'
        ? 'Idle — no recent traces'
        : 'No traces yet';

  return (
    <header className="po-hero">
      <div className="po-hero-l">
        <div className="po-hero-name">
          <span className={'po-dot ' + dotClass} />
          <h1>{project.name}</h1>
        </div>
        <div className="po-hero-meta">
          <span className="po-hero-status">{dotLabel}</span>
          <span className="po-hero-dot">·</span>
          <span className="po-mono">{project.slug}</span>
          {keyPrefix && (
            <>
              <span className="po-hero-dot">·</span>
              <span className="po-mono">{keyPrefix}</span>
            </>
          )}
          <span className="po-hero-dot">·</span>
          <span>Created {shortDate(project.created_at)}</span>
        </div>
      </div>
      <div className="po-hero-r">
        <button className="po-btn po-btn-ghost" type="button" disabled>
          Settings
        </button>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
   KPI row — all values derived from stats / stats.deltas /
   stats.timeseries. Cost has no delta or sparkline in the
   contract (see BACKEND_GAPS.md).
   ─────────────────────────────────────────────────────────── */

type Kpi = {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaDir?: 'up' | 'down' | 'flat';
  sparkValues?: number[];
  sparkColor?: string;
};

function KpiCard({ label, value, unit, delta, deltaDir = 'flat', sparkValues, sparkColor }: Kpi) {
  return (
    <div className="po-kpi">
      <div className="po-kpi-label">{label}</div>
      <div className="po-kpi-value">
        <span className="po-mono">{value}</span>
        {unit && <span className="po-kpi-unit">{unit}</span>}
      </div>
      {sparkValues && (
        <div className="po-kpi-spark">
          <Sparkline values={sparkValues} color={sparkColor ?? 'var(--po-fg-3)'} width={140} height={22} />
        </div>
      )}
      {delta && (
        <div className={'po-kpi-delta po-delta-' + deltaDir}>
          <span className="po-delta-glyph">
            {deltaDir === 'up' ? '↑' : deltaDir === 'down' ? '↓' : '→'}
          </span>
          <span className="po-mono">{delta}</span>
        </div>
      )}
    </div>
  );
}

function dirOf(n: number): 'up' | 'down' | 'flat' {
  if (Math.abs(n) < 1e-9) return 'flat';
  return n > 0 ? 'up' : 'down';
}

function buildKpis(stats: StatsResponse, state: ConnState): Kpi[] {
  if (state === 'never') {
    return [
      { label: 'Traces', value: '0', delta: '—', deltaDir: 'flat' },
      { label: 'Healthy rate', value: '—', deltaDir: 'flat' },
      { label: 'Avg sufficiency', value: '—', deltaDir: 'flat' },
      { label: 'Avg faithfulness', value: '—', deltaDir: 'flat' },
      { label: 'Cost', value: '$0.00' },
    ];
  }

  const volumes = stats.timeseries.map((b) => b.count);
  const healthyRates = stats.timeseries.map((b) => (b.count > 0 ? b.ok / b.count : 0));
  // avg_sufficiency / avg_faithfulness are float|null at runtime — coerce before charting.
  const sufficiency = stats.timeseries.map((b) => b.avg_sufficiency ?? 0);
  const faithfulness = stats.timeseries.map((b) => b.avg_faithfulness ?? 0);

  return [
    {
      label: 'Traces',
      value: stats.total_traces.toLocaleString(),
      delta: `${(stats.deltas.total_traces_pct_24h ?? 0) > 0 ? '+' : ''}${(stats.deltas.total_traces_pct_24h ?? 0).toFixed(1)}%`,
      deltaDir: dirOf(stats.deltas.total_traces_pct_24h ?? 0),
      sparkValues: volumes,
      sparkColor: 'var(--po-fg-3)',
    },
    {
      label: 'Healthy rate',
      value: ((stats.healthy_rate ?? 0) * 100).toFixed(1),
      unit: '%',
      delta: `${Math.abs(stats.deltas.healthy_rate_pp_24h ?? 0).toFixed(1)} pp`,
      deltaDir: dirOf(stats.deltas.healthy_rate_pp_24h ?? 0),
      sparkValues: healthyRates,
      sparkColor: 'var(--po-live)',
    },
    {
      label: 'Avg sufficiency',
      value: (stats.avg_sufficiency ?? 0).toFixed(2),
      delta: `${(stats.deltas.avg_sufficiency_delta_24h ?? 0) > 0 ? '+' : ''}${(stats.deltas.avg_sufficiency_delta_24h ?? 0).toFixed(2)}`,
      deltaDir: dirOf(stats.deltas.avg_sufficiency_delta_24h ?? 0),
      sparkValues: sufficiency,
      sparkColor: 'var(--po-fg-3)',
    },
    {
      label: 'Avg faithfulness',
      value: (stats.avg_faithfulness ?? 0).toFixed(2),
      delta: `${(stats.deltas.avg_faithfulness_delta_24h ?? 0) > 0 ? '+' : ''}${(stats.deltas.avg_faithfulness_delta_24h ?? 0).toFixed(2)}`,
      deltaDir: dirOf(stats.deltas.avg_faithfulness_delta_24h ?? 0),
      sparkValues: faithfulness,
      sparkColor: 'var(--po-fg-3)',
    },
    {
      // Cost: value only. No per-bucket cost + no delta_24h in contract — see BACKEND_GAPS.md.
      label: 'Cost',
      value: `$${(stats.total_cost_usd ?? 0).toFixed(2)}`,
    },
  ];
}

function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <section className="po-kpi-row">
      {items.map((k, i) => (
        <KpiCard key={i} {...k} />
      ))}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Healthy-rate card
   ─────────────────────────────────────────────────────────── */

function HealthyRateCard({ stats }: { stats: StatsResponse }) {
  const rate = (stats.healthy_rate ?? 0) * 100;
  const deltaPP = stats.deltas.healthy_rate_pp_24h ?? 0;
  const values = stats.timeseries.map((b) => (b.count > 0 ? (b.ok / b.count) * 100 : 0));
  const dir = dirOf(deltaPP);
  const groundedCount = stats.by_cell.complete_grounded;

  return (
    <div className="po-card po-hr">
      <div className="po-card-head">
        <div>
          <div className="po-card-title">Healthy rate</div>
          <div className="po-card-sub">last 24h · hourly</div>
        </div>
        <div className={'po-hr-delta po-delta-' + dir}>
          <span className="po-delta-glyph">{dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'}</span>
          <span className="po-mono">{Math.abs(deltaPP).toFixed(1)} pp</span>
          <span className="po-card-sub">vs yesterday</span>
        </div>
      </div>
      <div className="po-hr-body">
        <div className="po-hr-figure">
          <div className="po-hr-rate">
            <span className="po-mono">{rate.toFixed(1)}</span>
            <span className="po-hr-pct">%</span>
          </div>
          <div className="po-hr-sub">
            of {groundedCount.toLocaleString()} traces grounded &amp; complete
          </div>
        </div>
        <div className="po-hr-spark">
          <Sparkline
            values={values}
            color="var(--po-live)"
            fill="rgba(163, 177, 138, 0.12)"
            width={420}
            height={104}
            dot
          />
          <div className="po-hr-axis">
            <span className="po-mono">−24h</span>
            <span className="po-mono">−12h</span>
            <span className="po-mono">now</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Connection card — live / idle / never. Only fields the
   contract gives us. (Stream uptime, SDK version, average gap
   are gaps — see BACKEND_GAPS.md.)
   ─────────────────────────────────────────────────────────── */

type Lang = 'python' | 'node' | 'curl';

function snippetFor(lang: Lang, key: string): string {
  if (lang === 'python') {
    return `pip install veralith

from veralith import Veralith
v = Veralith(api_key="${key}")

trace = v.trace(query="What is the Rule of 72?")
trace.log(response="Divide 72 by…", chunks=[…])`;
  }
  if (lang === 'node') {
    return `npm install veralith

import { Veralith } from "veralith";
const v = new Veralith({ apiKey: "${key}" });

const trace = v.trace({ query: "What is the Rule of 72?" });
await trace.log({ response: "Divide 72 by…", chunks: [...] });`;
  }
  return `curl -X POST https://api.veralithai.com/v1/traces \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "What is the Rule of 72?",
    "response": "Divide 72 by the rate of return…",
    "context": [{"rank": 0, "text": "…", "score": 0.82}]
  }'`;
}

function ConnectionCard({
  state,
  lastTrace,
  apiKey,
  onJumpToLive,
}: {
  state: ConnState;
  lastTrace: TraceListItem | undefined;
  apiKey: string | null;
  onJumpToLive?: () => void;
}) {
  const [lang, setLang] = useState<Lang>('python');
  const [copied, setCopied] = useState(false);
  const lastAgo = lastTrace ? relativeTime(lastTrace.created_at) : '—';

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippetFor(lang, apiKey ?? 'vk_live_…'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  if (state === 'live') {
    return (
      <div className="po-card po-conn po-conn-live">
        <div className="po-card-head">
          <div>
            <div className="po-card-title">Connection</div>
            <div className="po-card-sub">SSE · /v1/events</div>
          </div>
          <div className="po-conn-state">
            <span className="po-dot po-dot-live" />
            <span className="po-conn-state-label">Live</span>
          </div>
        </div>
        <div className="po-conn-body">
          <div className="po-conn-stat">
            <span className="po-conn-stat-label">Last trace</span>
            <span className="po-mono po-conn-stat-val">{lastAgo}</span>
          </div>
          {apiKey && (
            <div className="po-conn-stat">
              <span className="po-conn-stat-label">API key</span>
              <span className="po-mono po-conn-stat-val">{apiKey}</span>
            </div>
          )}
        </div>
        <div className="po-conn-foot">
          <button
            type="button"
            className="po-link"
            onClick={onJumpToLive}
            disabled={!onJumpToLive}
            style={{ background: 'none', border: 'none', padding: 0, cursor: onJumpToLive ? 'pointer' : 'default' }}
          >
            View live stream →
          </button>
        </div>
      </div>
    );
  }

  if (state === 'idle') {
    return (
      <div className="po-card po-conn po-conn-idle">
        <div className="po-card-head">
          <div>
            <div className="po-card-title">Connection</div>
            <div className="po-card-sub">SSE · /v1/events</div>
          </div>
          <div className="po-conn-state">
            <span className="po-dot po-dot-idle" />
            <span className="po-conn-state-label">Idle</span>
          </div>
        </div>
        <div className="po-conn-body">
          <div className="po-conn-stat">
            <span className="po-conn-stat-label">Last trace</span>
            <span className="po-mono po-conn-stat-val">{lastAgo}</span>
          </div>
          {apiKey && (
            <div className="po-conn-stat">
              <span className="po-conn-stat-label">API key</span>
              <span className="po-mono po-conn-stat-val">{apiKey}</span>
            </div>
          )}
        </div>
        <div className="po-conn-note">
          No new traces in the last 5 minutes. Your SDK may still be connected — traffic may have dropped.
        </div>
      </div>
    );
  }

  // never
  return (
    <div className="po-card po-conn po-conn-never">
      <div className="po-card-head">
        <div>
          <div className="po-card-title">Connect your SDK</div>
          <div className="po-card-sub">Three lines to start receiving traces</div>
        </div>
        <div className="po-conn-state">
          <span className="po-dot po-dot-grey" />
          <span className="po-conn-state-label">Waiting</span>
        </div>
      </div>

      <div className="po-conn-tabs">
        {(['python', 'node', 'curl'] as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            className={'po-conn-tab' + (lang === l ? ' is-active' : '')}
            onClick={() => setLang(l)}
          >
            {l}
          </button>
        ))}
        <span className="po-conn-tabs-fill" />
        <button type="button" className="po-conn-copy" onClick={copy} aria-label="Copy snippet">
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5.5 3.5V2.5a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H9.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
              copy
            </>
          )}
        </button>
      </div>

      <pre className="po-snippet">
        <code>{snippetFor(lang, apiKey ?? 'vk_live_…')}</code>
      </pre>

      <div className="po-conn-foot">
        <span className="po-conn-poll">
          <span className="po-poll-dot" />
          <span className="po-mono">Polling for first trace…</span>
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Analytics CTA
   ─────────────────────────────────────────────────────────── */

function AnalyticsCta({ slug }: { slug: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="po-cta" onClick={() => navigate(`/projects/${slug}/analytics`)}>
      <div className="po-cta-l">
        <span className="po-cta-ic">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 13l3-6 3 3 3-7 3 5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <div className="po-cta-t">Open Analytics</div>
          <div className="po-cta-s">Trends, latency percentiles, cell drift, calibration</div>
        </div>
      </div>
      <span className="po-cta-arrow">→</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page
   ─────────────────────────────────────────────────────────── */

export default function ProjectOverview() {
  const { slug = '' } = useParams<{ slug: string }>();
  const stats = useStats(slug);
  const lastTrace = useTraces(slug, { limit: 1 });
  const apiKeys = useApiKeys(slug);
  const projects = useProjects();

  const foundProject = useMemo<Project | undefined>(() => {
    return projects.data?.projects.find((p) => p.slug === slug || p.id === slug);
  }, [projects.data, slug]);

  // Fall back to a slug-derived shell if the project isn't in the loaded list
  // (happens after a hard refresh under VITE_USE_MOCK_API=true — the in-memory
  // mock store is wiped but the URL is still valid). The page renders against
  // stats/lastTrace/apiKeys regardless.
  const project: Project = foundProject ?? {
    id: slug,
    user_id: '',
    name: slug,
    slug,
    created_at: new Date().toISOString(),
    trace_count: stats.data?.total_traces ?? 0,
  };

  const last: TraceListItem | undefined = lastTrace.data?.traces[0];
  const state = deriveConnState(stats.data, last);
  const keyPrefix = apiKeys.data?.api_keys[0]?.prefix ?? null;

  const isLoading = stats.isLoading || lastTrace.isLoading || apiKeys.isLoading;
  const isError = stats.isError;

  if (isLoading) {
    return (
      <ProjectShell slug={slug} active="overview" project={project.name}>
        <div className="po-page-loading">Loading project overview…</div>
      </ProjectShell>
    );
  }
  if (isError || !stats.data) {
    return (
      <ProjectShell slug={slug} active="overview" project={project.name}>
        <div className="po-page-error">Failed to load project overview.</div>
      </ProjectShell>
    );
  }

  const kpis = buildKpis(stats.data, state);

  return (
    <ProjectShell slug={slug} active="overview" project={project.name}>
      <div className="po-page">
        <ProjectHero project={project} keyPrefix={keyPrefix} state={state} />
        <KpiRow items={kpis} />

        <section className={'po-two-up' + (state === 'never' ? ' is-never' : '')}>
          {state !== 'never' && <HealthyRateCard stats={stats.data} />}
          <ConnectionCard state={state} lastTrace={last} apiKey={keyPrefix} />
        </section>

        {state !== 'never' ? (
          <AnalyticsCta slug={slug} />
        ) : (
          <div className="po-empty-cta">
            Analytics &amp; trace explorer unlock once your first trace arrives.
          </div>
        )}

        <ApiKeysSection projectId={project.id} apiKeys={apiKeys.data?.api_keys ?? []} />
      </div>
    </ProjectShell>
  );
}

/* ─────────────────────────────────────────────────────────────
   API Keys section — list + revoke. Uses .ak-* styles.
   ─────────────────────────────────────────────────────────── */

function ApiKeysSection({ projectId, apiKeys }: { projectId: string; apiKeys: ApiKey[] }) {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTarget = apiKeys.find((k) => k.id === confirmId);

  const revoke = useMutation({
    mutationFn: (keyId: string) => api.deleteApiKey(projectId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] });
    },
  });

  if (apiKeys.length === 0) return null;

  return (
    <div className="ak-card" style={{ marginTop: 24 }}>
      <div className="ak-card-head">
        <div>
          <div className="ak-card-title">API keys</div>
          <div className="ak-card-sub">
            Keys authenticate the SDK and ingest endpoints. Revoked keys stay listed for audit.
          </div>
        </div>
      </div>
      <div className="ak-list">
        {apiKeys.map((k) => {
          const revoked = k.revoked_at !== null;
          return (
            <div key={k.id} className={'ak-row' + (revoked ? ' is-revoked' : '')}>
              <div className="ak-key-ic">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="5.5" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M8.3 8H14M11.5 8v2.4M13.2 8v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="ak-main">
                <div className="ak-titlerow">
                  <span className="ak-name">{k.name ?? 'default'}</span>
                </div>
                <div className="ak-meta">
                  <span className={'ak-prefix' + (revoked ? ' is-struck' : '')}>{k.prefix}</span>
                  <span className="he-dot-sep">·</span>
                  <span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                  {k.last_used_at && (
                    <>
                      <span className="he-dot-sep">·</span>
                      <span>Last used {new Date(k.last_used_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="ak-action">
                {revoked ? (
                  <span className="ak-revoked-pill">
                    Revoked {new Date(k.revoked_at!).toLocaleDateString()}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="ak-revoke"
                    onClick={() => setConfirmId(k.id)}
                    disabled={revoke.isPending}
                  >Revoke</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {confirmTarget && (
        <div className="he-modal-scrim" onClick={() => setConfirmId(null)}>
          <div className="he-modal" onClick={(e) => e.stopPropagation()}>
            <div className="he-modal-title">Revoke this API key?</div>
            <div className="he-modal-body">
              Requests using <span className="se-mono ak-modal-prefix">{confirmTarget.prefix}…</span> will
              return <span className="se-mono">401</span> immediately. This cannot be undone.
              Issue a new key first if you have running services.
            </div>
            <div className="he-modal-actions">
              <button className="he-btn he-btn-ghost" onClick={() => setConfirmId(null)}>Cancel</button>
              <button
                className="he-btn he-btn-danger"
                onClick={() => {
                  revoke.mutate(confirmTarget.id);
                  setConfirmId(null);
                }}
              >Revoke</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
