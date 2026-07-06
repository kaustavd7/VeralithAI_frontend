/* ============================================================================
   ⚠ UNROUTED — this page is NOT mounted in App.tsx. The live "/projects/:slug"
   overview route renders routes/TodayOverview.tsx (demo data). This component is
   kept ON PURPOSE: it holds the real-API wiring (useStats / useTraces /
   useApiKeys + revoke) for when Overview is moved onto live data. Do not delete;
   when wiring the real Overview, merge TodayOverview's visual treatment onto this
   component's data hooks and route it here, then retire the demo. (See the
   consistency-audit openQuestion on ProjectOverview vs TodayOverview.)
   ============================================================================ */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { LoadingState, ErrorState } from '../components/StateViews';
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
  const navigate = useNavigate();
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
        <button
          className="po-btn po-btn-ghost"
          type="button"
          onClick={() => navigate('/settings')}
        >
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

/* ─────────────────────────────────────────────────────────────
   SDK connect block — a dark IDE-style integration card shown
   when no traces have arrived yet. The snippets are the REAL
   API: Python = `veralith.log(...)`; node/curl = the REST
   `POST /v1/traces` call (there is no node SDK).

   Each snippet is authored as lines of typed tokens so we can
   render subtle syntax coloring. `tk()` is shorthand for a
   single token; `plainCopy()` flattens a snippet back to text
   for the Copy button.
   ─────────────────────────────────────────────────────────── */

type TokKind = 'cmt' | 'kw' | 'str' | 'fn' | 'num' | 'punct' | 'plain';
type Tok = { t: string; k: TokKind };
type CodeLine = Tok[];

const tk = (t: string, k: TokKind = 'plain'): Tok => ({ t, k });

/** Filename shown on the editor window-chrome tab, per language. */
function fileNameFor(lang: Lang): string {
  if (lang === 'python') return 'rag_pipeline.py';
  if (lang === 'node') return 'trace.js';
  return 'send_trace.sh';
}

function snippetLines(lang: Lang, key: string): CodeLine[] {
  if (lang === 'python') {
    return [
      [tk('# 1. install', 'cmt')],
      [tk('pip', 'fn'), tk(' install veralith')],
      [],
      [tk('# 2. export your project key', 'cmt')],
      [tk('export', 'kw'), tk(' VERALITH_API_KEY='), tk(`"${key}"`, 'str')],
      [],
      [tk('# 3. log one trace from your RAG pipeline', 'cmt')],
      [tk('import', 'kw'), tk(' veralith', 'fn')],
      [],
      [
        tk('trace_id = veralith.', 'plain'),
        tk('log', 'fn'),
        tk('('),
      ],
      [
        tk('    query', 'plain'),
        tk('='),
        tk('"What is the Rule of 72?"', 'str'),
        tk(','),
      ],
      [
        tk('    context', 'plain'),
        tk('=['),
        tk('"Divide 72 by the annual rate…"', 'str'),
        tk('],'),
      ],
      [
        tk('    response', 'plain'),
        tk('='),
        tk('"At 8%, money doubles in ~9 years."', 'str'),
        tk(','),
      ],
      [tk(')')],
      [],
      [tk('# or zero-reshape: decorate your RAG fn', 'cmt')],
      [tk('@veralith.trace', 'fn'), tk('  ', 'plain'), tk('# auto-measures latency', 'cmt')],
    ];
  }
  if (lang === 'node') {
    return [
      [tk('// No node SDK — POST a trace to the REST API.', 'cmt')],
      [tk('await', 'kw'), tk(' '), tk('fetch', 'fn'), tk('('), tk('"https://api.veralithai.com/v1/traces"', 'str'), tk(', {')],
      [tk('  method'), tk(': '), tk('"POST"', 'str'), tk(',')],
      [tk('  headers'), tk(': {')],
      [tk('    '), tk('"Authorization"', 'str'), tk(': '), tk(`"Bearer ${key}"`, 'str'), tk(',')],
      [tk('    '), tk('"Content-Type"', 'str'), tk(': '), tk('"application/json"', 'str'), tk(',')],
      [tk('  },')],
      [tk('  body'), tk(': '), tk('JSON', 'fn'), tk('.'), tk('stringify', 'fn'), tk('({')],
      [tk('    query'), tk(': '), tk('"What is the Rule of 72?"', 'str'), tk(',')],
      [tk('    response'), tk(': '), tk('"At 8%, money doubles in ~9 years."', 'str'), tk(',')],
      [tk('    retrieved_chunks'), tk(': ['), tk('"Divide 72 by the annual rate…"', 'str'), tk('],')],
      [tk('  }),')],
      [tk('});')],
    ];
  }
  // curl
  return [
    [tk('# POST a trace to the REST API', 'cmt')],
    [tk('curl', 'fn'), tk(' -X POST https://api.veralithai.com/v1/traces \\')],
    [tk('  -H '), tk(`"Authorization: Bearer ${key}"`, 'str'), tk(' \\')],
    [tk('  -H '), tk('"Content-Type: application/json"', 'str'), tk(' \\')],
    [tk("  -d '{")],
    [tk('    '), tk('"query"', 'str'), tk(': '), tk('"What is the Rule of 72?"', 'str'), tk(',')],
    [tk('    '), tk('"response"', 'str'), tk(': '), tk('"At 8%, money doubles in ~9 years."', 'str'), tk(',')],
    [tk('    '), tk('"retrieved_chunks"', 'str'), tk(': ['), tk('"Divide 72 by the annual rate…"', 'str'), tk(']')],
    [tk("  }'")],
  ];
}

/** Flatten tokenized lines into a copyable plain-text snippet. */
function plainCopy(lines: CodeLine[]): string {
  return lines.map((line) => line.map((t) => t.t).join('')).join('\n');
}

/* ─────────────────────────────────────────────────────────────
   MCP (agent) connect snippets — the SECOND half of onboarding.
   Point a coding agent (Claude Code / Cursor / Codex) at the
   hosted MCP server so it can read heal cards and open fix PRs.

   We default to the `${VERALITH_API_KEY}` env indirection (and
   Codex's `bearer_token_env_var`) so the key lives in ONE place —
   the same var the SDK reads. Change the project key once and both
   the SDK and the agent follow; no second edit in .mcp.json.
   ─────────────────────────────────────────────────────────── */

type McpClient = 'claude' | 'cursor' | 'codex';

const MCP_URL = 'https://api.veralithai.com/mcp/http';

/** Filename shown on the editor window-chrome tab, per MCP client. */
function mcpFileNameFor(c: McpClient): string {
  if (c === 'claude') return '.mcp.json';
  if (c === 'cursor') return '.cursor/mcp.json';
  return '~/.codex/config.toml';
}

function mcpSnippetLines(c: McpClient, key: string): CodeLine[] {
  if (c === 'claude') {
    return [
      [tk('{')],
      [tk('  '), tk('"mcpServers"', 'str'), tk(': {')],
      [tk('    '), tk('"veralith"', 'str'), tk(': {')],
      [tk('      '), tk('"type"', 'str'), tk(': '), tk('"http"', 'str'), tk(',')],
      [tk('      '), tk('"url"', 'str'), tk(': '), tk(`"${MCP_URL}"`, 'str'), tk(',')],
      [
        tk('      '), tk('"headers"', 'str'), tk(': { '),
        tk('"Authorization"', 'str'), tk(': '),
        tk('"Bearer ${VERALITH_API_KEY}"', 'str'), tk(' }'),
      ],
      [tk('    }')],
      [tk('  }')],
      [tk('}')],
    ];
  }
  if (c === 'cursor') {
    return [
      [tk('{')],
      [tk('  '), tk('"mcpServers"', 'str'), tk(': {')],
      [tk('    '), tk('"veralith"', 'str'), tk(': {')],
      [tk('      '), tk('"type"', 'str'), tk(': '), tk('"streamableHttp"', 'str'), tk(',')],
      [tk('      '), tk('"url"', 'str'), tk(': '), tk(`"${MCP_URL}"`, 'str'), tk(',')],
      [
        tk('      '), tk('"headers"', 'str'), tk(': { '),
        tk('"Authorization"', 'str'), tk(': '),
        tk(`"Bearer ${key}"`, 'str'), tk(' }'),
      ],
      [tk('    }')],
      [tk('  }')],
      [tk('}')],
    ];
  }
  // codex — native env indirection via bearer_token_env_var
  return [
    [tk('[mcp_servers.veralith]', 'fn')],
    [tk('url'), tk(' = '), tk(`"${MCP_URL}"`, 'str')],
    [tk('bearer_token_env_var'), tk(' = '), tk('"VERALITH_API_KEY"', 'str')],
    [],
    [tk('# reads the same key env var as the SDK', 'cmt')],
  ];
}

/* Token color map for the (intentionally fixed) dark code surface.
   These are code-editor syntax hues, not themeable surfaces, so they
   are deliberately hard-coded against the #0d1117 background. */
const TOK_COLOR: Record<TokKind, string> = {
  cmt: '#6b7689', // muted comment grey
  kw: '#c792ea', // mauve keyword (import / export / await)
  str: '#9ad8a0', // soft emerald-leaning green for strings
  fn: '#79b8ff', // function / identifier blue
  num: '#f2a96b', // numeric / literal amber
  punct: '#8b94a3', // punctuation
  plain: '#cdd4df', // default code foreground
};

function CodeBlock({ lines }: { lines: CodeLine[] }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: '14px 16px 16px',
        background: 'transparent',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12.5,
        lineHeight: 1.7,
        color: TOK_COLOR.plain,
        overflowX: 'auto',
        whiteSpace: 'pre',
        tabSize: 2,
      }}
    >
      <code>
        {lines.map((line, i) => (
          <span key={i} style={{ display: 'block', minHeight: '1.7em' }}>
            {line.map((seg, j) => (
              <span key={j} style={{ color: TOK_COLOR[seg.k] }}>
                {seg.t}
              </span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  );
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

  // Masked key prefix for the snippets. The full secret is only ever shown
  // once at creation; here we show the real `vk_live_…` prefix from useApiKeys.
  const keyDisplay = apiKey ?? 'vk_live_…';

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainCopy(snippetLines(lang, keyDisplay)));
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

  // never — the polished centerpiece: a dark IDE-style integration block.
  // The editor surface is an INTENTIONALLY fixed dark code surface (#0d1117)
  // even in light theme, so syntax coloring reads correctly. The outer card
  // frame still uses --po-* tokens to sit in the layered-dark layout.
  const langs: Lang[] = ['python', 'node', 'curl'];
  return (
    <div className="po-card po-conn po-conn-never" style={{ overflow: 'hidden', padding: 0 }}>
      <div className="po-card-head" style={{ padding: 'var(--card-pad)', marginBottom: 0 }}>
        <div>
          <div className="po-card-title">Connect your SDK</div>
          <div className="po-card-sub">One line in your RAG pipeline starts the stream</div>
        </div>
        <div className="po-conn-state">
          <span className="po-dot po-dot-grey" />
          <span className="po-conn-state-label">Waiting</span>
        </div>
      </div>

      {/* ── IDE editor surface (fixed dark, not themeable) ───────────────── */}
      <div
        style={{
          margin: '0 var(--space-6) var(--space-4)',
          borderRadius: 'var(--po-radius-sm)',
          border: '1px solid #1c2430',
          background: '#0d1117',
          overflow: 'hidden',
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.32)',
        }}
      >
        {/* window chrome: traffic-light dots + filename tab */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 38,
            padding: '0 12px',
            background: '#11161f',
            borderBottom: '1px solid #1c2430',
          }}
        >
          <span style={{ display: 'flex', gap: 7 }} aria-hidden="true">
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
          </span>
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 12,
              color: '#8b94a3',
              padding: '4px 10px',
              borderRadius: 5,
              background: '#0d1117',
              border: '1px solid #1c2430',
            }}
          >
            {fileNameFor(lang)}
          </span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={copy}
            aria-label="Copy snippet"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: '0 10px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 11.5,
              color: copied ? 'var(--po-live)' : '#9aa3b2',
              background: '#0d1117',
              border: '1px solid #1c2430',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
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

        {/* language tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 2,
            padding: '0 8px',
            background: '#0f141c',
            borderBottom: '1px solid #1c2430',
          }}
        >
          {langs.map((l) => {
            const active = l === lang;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: 'transparent',
                  padding: '9px 12px 8px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: 12,
                  color: active ? '#e6edf3' : '#6b7689',
                  borderBottom: active ? '2px solid var(--po-live)' : '2px solid transparent',
                  cursor: 'pointer',
                  letterSpacing: 0.2,
                }}
              >
                {l}
              </button>
            );
          })}
        </div>

        {/* the code, with subtle syntax coloring */}
        <CodeBlock lines={snippetLines(lang, keyDisplay)} />
      </div>

      {/* live polling status with pulsing emerald dot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 var(--space-6) var(--space-6)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--po-live)',
            animation: 'pulse 1.8s ease-out infinite',
            flex: '0 0 auto',
          }}
        />
        <span className="po-mono" style={{ fontSize: 12.5, color: 'var(--po-fg-3)' }}>
          Polling for first trace…
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Agent connect card — step 2 of onboarding, shown in the `never`
   state beneath the SDK card. Same fixed-dark IDE surface; client
   tabs for Claude Code / Cursor / Codex. The snippets prefer the
   ${VERALITH_API_KEY} env indirection so the key stays single-source.
   ─────────────────────────────────────────────────────────── */

function AgentConnectCard({ apiKey }: { apiKey: string | null }) {
  const [client, setClient] = useState<McpClient>('claude');
  const [copied, setCopied] = useState(false);
  const keyDisplay = apiKey ?? 'vk_live_…';

  const clients: { id: McpClient; label: string }[] = [
    { id: 'claude', label: 'Claude Code' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'codex', label: 'Codex' },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainCopy(mcpSnippetLines(client, keyDisplay)));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="po-card po-conn po-conn-never" style={{ overflow: 'hidden', padding: 0, marginTop: 'var(--space-4)' }}>
      <div className="po-card-head" style={{ padding: 'var(--card-pad)', marginBottom: 0 }}>
        <div>
          <div className="po-card-title">Connect your coding agent</div>
          <div className="po-card-sub">So your agent can read heal cards and open fix PRs</div>
        </div>
        <div className="po-conn-state">
          <span className="po-dot po-dot-grey" />
          <span className="po-conn-state-label">Optional</span>
        </div>
      </div>

      {/* ── IDE editor surface (fixed dark, not themeable) ───────────────── */}
      <div
        style={{
          margin: '0 var(--space-6) var(--space-4)',
          borderRadius: 'var(--po-radius-sm)',
          border: '1px solid #1c2430',
          background: '#0d1117',
          overflow: 'hidden',
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.32)',
        }}
      >
        {/* window chrome: traffic-light dots + filename tab + copy */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 38,
            padding: '0 12px',
            background: '#11161f',
            borderBottom: '1px solid #1c2430',
          }}
        >
          <span style={{ display: 'flex', gap: 7 }} aria-hidden="true">
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
          </span>
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 12,
              color: '#8b94a3',
              padding: '4px 10px',
              borderRadius: 5,
              background: '#0d1117',
              border: '1px solid #1c2430',
            }}
          >
            {mcpFileNameFor(client)}
          </span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={copy}
            aria-label="Copy snippet"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: '0 10px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 11.5,
              color: copied ? 'var(--po-live)' : '#9aa3b2',
              background: '#0d1117',
              border: '1px solid #1c2430',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
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

        {/* client tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: '0 8px',
            background: '#0f141c',
            borderBottom: '1px solid #1c2430',
          }}
        >
          {clients.map(({ id, label }) => {
            const active = id === client;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setClient(id)}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: 'transparent',
                  padding: '9px 12px 8px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: 12,
                  color: active ? '#e6edf3' : '#6b7689',
                  borderBottom: active ? '2px solid var(--po-live)' : '2px solid transparent',
                  cursor: 'pointer',
                  letterSpacing: 0.2,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* the config, with subtle syntax coloring */}
        <CodeBlock lines={mcpSnippetLines(client, keyDisplay)} />
      </div>

      {/* footnote: verify + single-source-of-truth note */}
      <div
        style={{
          padding: '0 var(--space-6) var(--space-6)',
          fontSize: 12.5,
          color: 'var(--po-fg-3)',
          lineHeight: 1.65,
        }}
      >
        Reload your agent, then run <code className="po-mono">/mcp</code> to confirm{' '}
        <b style={{ color: 'var(--po-fg-2)' }}>veralith</b> is connected.{' '}
        <code className="po-mono">{'${VERALITH_API_KEY}'}</code> reads the same key as your SDK —
        export it once and changing your project key updates both.
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
  const location = useLocation();

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

  // Primary queries gate the page: stats + traces (last-trace). apiKeys is
  // secondary (its section self-hides when empty), so it doesn't block render.
  const isPending = stats.isPending || lastTrace.isPending;
  const isError = stats.isError || lastTrace.isError;

  // Deep-link: when navigated here with #api-keys (e.g. from the account menu),
  // scroll the keys section into view once the data has settled and it rendered.
  useEffect(() => {
    if (location.hash !== '#api-keys') return;
    const el = document.getElementById('api-keys');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, apiKeys.data, stats.data]);

  if (isPending) {
    return (
      <ProjectShell slug={slug} active="overview" project={project.name}>
        <LoadingState label="Loading project overview…" />
      </ProjectShell>
    );
  }
  if (isError || !stats.data) {
    const message =
      (stats.error ?? lastTrace.error)?.message ?? 'Failed to load project overview.';
    return (
      <ProjectShell slug={slug} active="overview" project={project.name}>
        <ErrorState
          message={message}
          onRetry={() => {
            stats.refetch();
            lastTrace.refetch();
          }}
        />
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

        {state === 'never' && <AgentConnectCard apiKey={keyPrefix} />}

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
    <div className="ak-card" id="api-keys" style={{ marginTop: 24 }}>
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
