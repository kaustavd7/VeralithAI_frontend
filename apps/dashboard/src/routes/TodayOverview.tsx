import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { HealthDonut } from '../components/charts/HealthDonut';
import { ProfileBadges } from '../components/charts/ProfileBadges';
import { useStats, useCategoryInsights, useInsightSummary, useApiKeys } from '../hooks/useOverviewData';
import { ConnectCards } from '../components/ConnectCards';
import { api } from '../api/client';
import type { CategoryInsight, FailureCell, StatsResponse } from '../api/types';
import { LoadingState, ErrorState } from '../components/StateViews';
import { analyticsPath, cellsPath, healsPath, tracesPath } from '../lib/nav';
import '../styles/today-workbench.css';

/* Inline reset so a real <button> matches the former inline-text `.ovc-link`
   <a> exactly (the .ovc-link CSS lives in another file we don't own). */
const LINK_BTN_RESET: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left',
};

/* Keyboard activation for elements given role="link"/role="button": fire the
   click handler on Enter or Space (and stop Space from scrolling the page). */
function onActivateKey(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      handler();
    }
  };
}

/* ────────────────────────────────────────────────────────────────────
   Project Overview "Today" — B2 triage command-center, glow variant.
   Pure-black canvas, borderless cards with a cursor-tracking glow border,
   gradient line charts, + the persistent Workbench drawer.
   DEMO DATA for now (deterministic) — wire to /stats, /traces, SSE later.
   ──────────────────────────────────────────────────────────────────── */

/* deterministic pseudo-data for the charts/sparklines */
function wfRnd(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function wfVals(seed: number, n: number, trend = 0.0, base = 0.42): number[] {
  const r = wfRnd(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    base += (r() - 0.5) * 0.28 + trend;
    base = Math.max(0.1, Math.min(0.94, base));
    out.push(base);
  }
  return out;
}
function wfPath(vals: number[], w: number, h: number, pad = 2): string {
  // Guard single-point / empty series: (i/(n-1)) is 0/0 = NaN when n<2, which
  // emits an invalid "M NaN …" path (the chart silently vanishes). Duplicate the
  // lone point so the line renders flat. Protects every caller (BigChart, Spark).
  const safe = vals.length >= 2 ? vals : [vals[0] ?? 0, vals[0] ?? 0];
  const n = safe.length;
  const inner = h - pad * 2;
  const pts = safe.map((v, i) => [(i / (n - 1)) * w, pad + (1 - v) * inner] as [number, number]);
  let d = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ', ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ', ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
  }
  return d;
}

let _gradN = 0;
function useGradId(seed: number) {
  return useMemo(() => 'wfgrad-' + seed + '-' + _gradN++, [seed]);
}

/* small inline sparkline (gradient fade fill) */
function Spark({ seed = 7, w = 132, h = 38, n = 13, trend = 0.012, color = 'var(--accent)', dot = true, values }: {
  seed?: number; w?: number; h?: number; n?: number; trend?: number; color?: string; dot?: boolean; values?: number[];
}) {
  const vals = values && values.length >= 2 ? values : wfVals(seed, n, trend);
  const d = wfPath(vals, w, h, 3);
  const lastY = 3 + (1 - vals[vals.length - 1]) * (h - 6);
  const gid = useGradId(seed);
  return (
    <svg className="wf-spark" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {dot && <circle cx={w - 0.5} cy={lastY} r="2.6" fill={color} />}
    </svg>
  );
}

/* wide timeline · gradient fill · hover-to-read tooltip */
function BigChart({ h = 170, seed = 3, n = 42, trend = 0.004, color = 'var(--accent)', cap = '// hourly · 00:00 → now', l = '12:00 AM', r = 'now', bare = false, fmt, xfmt, yticks, values }: {
  h?: number; seed?: number; n?: number; trend?: number; color?: string; cap?: string; l?: string; r?: string; bare?: boolean;
  fmt?: (v: number) => string; xfmt?: (i: number) => string; yticks?: { v: number; label: string }[];
  /** Real series (0..1) — overrides the demo seed generator when provided. */
  values?: number[];
}) {
  const W = 720;
  const innerH = h - 26;
  const GUT = 34; // fixed-px Y-axis label gutter (kept out of the SVG so the line never reaches it)
  // morph the line: tween the points from the current shape to the new one on data change
  const target = useMemo(
    () => (values && values.length ? values : wfVals(seed, n, trend)),
    [values, seed, n, trend],
  );
  const [vals, setVals] = useState(target);
  const N = vals.length;
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from.length !== target.length) { setVals(target); fromRef.current = target; return; }
    let raf = 0;
    const t0 = performance.now();
    const dur = 620;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVals(target.map((v, i) => from[i] + (v - from[i]) * e));
      if (p < 1) raf = requestAnimationFrame(frame);
      else { setVals(target); fromRef.current = target; }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const d = wfPath(vals, W, innerH, 3);
  const gid = useGradId(seed);
  const [hi, setHi] = useState<number | null>(null);
  const format = fmt || ((v: number) => (v * 100).toFixed(0) + '%');
  const xLabel = xfmt || ((i: number) => String(Math.round((i / (N - 1)) * 23)).padStart(2, '0') + ':00');

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHi(Math.round(frac * (N - 1)));
  }
  const px = hi == null ? 0 : (hi / (N - 1)) * W;
  // match wfPath's plotted y (pad + (1-v)*(h - 2*pad)) so the dot sits ON the line
  const py = hi == null ? 0 : 3 + (1 - vals[hi]) * (innerH - 6);
  const tipLeft = hi == null ? 0 : Math.max(7, Math.min(93, (hi / (N - 1)) * 100));
  const ty = (v: number) => 3 + (1 - v) * (innerH - 6); // matches the plotted line's y

  return (
    <div className={'wf-chart' + (bare ? ' wf-chart-bare' : '')}>
      <span className="wf-chart-cap po-mono">{cap}</span>
      <div className="wf-chart-plot">
        {yticks && (
          <div className="wf-chart-ycol" style={{ width: GUT }}>
            {yticks.map((t, i) => (
              <span key={'y' + i} className="wf-chart-ylab po-mono" style={{ top: ty(t.v) }}>{t.label}</span>
            ))}
          </div>
        )}
        <div className="wf-chart-svgwrap" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
          <svg className="wf-chart-svg" viewBox={`0 0 ${W} ${h}`} width="100%" height={h} preserveAspectRatio="none">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.30" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {yticks?.map((t, i) => (
              <line key={'g' + i} x1="0" x2={W} y1={ty(t.v)} y2={ty(t.v)} stroke="color-mix(in oklab, var(--po-fg) 9%, transparent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={`${d} L ${W} ${innerH + 3} L 0 ${innerH + 3} Z`} fill={`url(#${gid})`} />
            <path className="wf-chart-line" d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {hi != null && (
              <g>
                <line x1={px} x2={px} y1="3" y2={innerH + 3} stroke="var(--po-line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <circle cx={px} cy={py} r="3.6" fill={color} stroke="var(--po-bg)" strokeWidth="1.6" />
              </g>
            )}
          </svg>
          {hi != null && (
            <div className="wf-chart-tip" style={{ left: tipLeft + '%', top: py }}>
              <span className="wf-chart-tip-v">{format(vals[hi])}</span>
              <span className="wf-chart-tip-x po-mono">{xLabel(hi)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="wf-chart-axis po-mono" style={yticks ? { paddingLeft: GUT } : undefined}><span>{l}</span><span>{r}</span></div>
    </div>
  );
}

/* tiny building blocks */
function Delta({ dir = 'up', children }: { dir?: 'up' | 'down' | 'flat'; children: ReactNode }) {
  return <span className={'wf-delta wf-delta-' + dir}>{dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'} {children}</span>;
}
/* ── period toggle (Today / Yesterday / Last week) ── */
type StatRow = { l: string; v: string; d: 'up' | 'down' | 'flat'; ds: string; warn?: boolean };
type PeriodId = 'today' | 'yesterday' | 'week';
const PERIOD_TABS: { id: PeriodId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last week' },
];

// Resolve a period to a stats window. Day-aligned anchors keep the query key
// stable across renders (no refetch loop).
function periodWindow(period: PeriodId): { since: string; until?: string; bucket: 'hour' | 'day' } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t = start.getTime();
  const DAY = 86_400_000;
  if (period === 'today') return { since: new Date(t).toISOString(), bucket: 'hour' };
  if (period === 'yesterday')
    return { since: new Date(t - DAY).toISOString(), until: new Date(t).toISOString(), bucket: 'hour' };
  return { since: new Date(t - 7 * DAY).toISOString(), bucket: 'day' };
}
/* health bands: good ≥85%, warn 70–85%, bad <70%. Colours (incl. a
   light-mode-legible healthy green) live in CSS, keyed off the state class. */
function healthState(pct: number): 'good' | 'warn' | 'bad' {
  return pct >= 85 ? 'good' : pct >= 70 ? 'warn' : 'bad';
}
function healthLabel(pct: number): string {
  return pct >= 85 ? 'Healthy' : pct >= 70 ? 'Degraded' : 'Critical';
}
function HealthBadge({ pct, hasData = true }: { pct: number; hasData?: boolean }) {
  // No traces in the window → there's nothing to judge; don't cry "Critical".
  if (!hasData) return <span className="wf-health-badge is-none">No data</span>;
  return <span className={'wf-health-badge is-' + healthState(pct)}>{healthLabel(pct)}</span>;
}

/* Parse "1,284" / "86.9%" / "+7.3 pp" / "1.8s" into its numeric core + formatting,
   so the value can be either scrambled or smoothly tweened. */
function parseDisplay(s: string) {
  const m = s.match(/-?\d[\d,]*\.?\d*/);
  if (!m) return null;
  const core = m[0];
  const start = m.index ?? 0;
  const plain = core.replace(/,/g, '');
  const dot = plain.indexOf('.');
  return {
    prefix: s.slice(0, start),
    suffix: s.slice(start + core.length),
    hasComma: core.includes(','),
    decimals: dot >= 0 ? plain.length - dot - 1 : 0,
    num: parseFloat(plain),
  };
}
function formatNum(n: number, decimals: number, hasComma: boolean, prefix: string, suffix: string) {
  let core = n.toFixed(decimals);
  if (hasComma) {
    const [ip, dp] = core.split('.');
    core = Number(ip).toLocaleString('en-US') + (dp != null ? '.' + dp : '');
  }
  return prefix + core + suffix;
}

/* Counts the number UP to its value on first reveal (from 0, ease-out — fast then
   slow). On later value changes (e.g. a period switch) it counts from the current
   value to the new one. Format (commas / decimals / %/s suffix / sign) is preserved. */
function ScrambleNumber({ value, duration = 850, play = true }: { value: string; duration?: number; play?: boolean }) {
  const zeroed = () => { const t = parseDisplay(value); return t ? formatNum(0, t.decimals, t.hasComma, t.prefix, t.suffix) : value; };
  const [display, setDisplay] = useState(zeroed);
  const revealedRef = useRef(false);
  const numRef = useRef<number | null>(null);

  useEffect(() => {
    if (!play) return;
    const target = parseDisplay(value);
    if (!target) { setDisplay(value); revealedRef.current = true; return; }
    let cancelled = false;
    let raf = 0;
    const from = revealedRef.current ? (numRef.current ?? 0) : 0; // first reveal counts up from 0
    const to = target.num;
    const dur = revealedRef.current ? 620 : duration;
    const t0 = performance.now();
    const frame = (now: number) => {
      if (cancelled) return;
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3); // ease-out: fast start, slow settle
      setDisplay(formatNum(from + (to - from) * e, target.decimals, target.hasComma, target.prefix, target.suffix));
      if (p < 1) { raf = requestAnimationFrame(frame); }
      else { setDisplay(value); revealedRef.current = true; numRef.current = to; }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, play]);

  return <>{display}</>;
}

/* Fires once, when the element first scrolls into view. Uses a CALLBACK ref (not
   useRef + useEffect) so the observer (re)attaches whenever the node mounts. The
   Overview section is gated behind `{s && …}` and mounts only after stats load —
   a plain effect's deps [inView, threshold] never change on that late mount, so
   the observer would never attach and the section would stay hidden forever. */
function useInView(threshold = 0.12) {
  const [inView, setInView] = useState(false);
  const obsRef = useRef<IntersectionObserver | null>(null);
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      obsRef.current?.disconnect();
      if (!el || inView) return;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        },
        { threshold },
      );
      obs.observe(el);
      obsRef.current = obs;
    },
    [inView, threshold],
  );
  return [setRef, inView] as const;
}

/* ════════════════════════════════════════════════════════════════════
   Overview cells (the finalized "Overview" section — RAG health · latency ·
   ver-advice · knowledge-gap topics · potential improvement). Demo data.
   ════════════════════════════════════════════════════════════════════ */

/* generic card wrapper */
function OvCell({ title, sub, grow, children }: { title: string; sub?: string; grow?: boolean; children: ReactNode }) {
  return (
    <div className={'ovc-card' + (grow ? ' ovc-grow' : '')}>
      <div className="ovc-head">
        <div className="ovc-title">{title}</div>
        {sub && <span className="ovc-tag po-mono">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

/* RAG health — composite index + 3 metric rows with microtrend sparklines (live) */
const RH_TARGET = 0.85;
const rhColor = (v: number) => (v >= RH_TARGET ? 'var(--po-live)' : v >= RH_TARGET - 0.12 ? 'var(--po-idle)' : 'var(--po-bad)');
const fmt2 = (v: number) => v.toFixed(2);

function MetricDelta({ d }: { d: number }) {
  const dir = d > 0.005 ? 'up' : d < -0.005 ? 'down' : 'flat';
  const sym = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  return <span className={'wf-delta wf-delta-' + dir}>{sym} {(d >= 0 ? '+' : '') + d.toFixed(2)}</span>;
}

type RhMetric = { k: string; label: string; v: number; delta: number; spark: number[] };

function rhMetrics(s: StatsResponse | undefined): RhMetric[] {
  if (!s) return [];
  // Only REAL points — drop buckets with no data so the sparkline reflects
  // actual history (no zero-padding, no invented trend).
  const real = (vals: (number | null | undefined)[]): number[] =>
    vals.filter((v): v is number => v != null);
  return [
    { k: 'suff', label: 'Sufficiency', v: s.avg_sufficiency ?? 0, delta: s.deltas?.avg_sufficiency_delta_24h ?? 0, spark: real(s.timeseries.map((b) => b.avg_sufficiency)) },
    { k: 'faith', label: 'Faithfulness', v: s.avg_faithfulness ?? 0, delta: s.deltas?.avg_faithfulness_delta_24h ?? 0, spark: real(s.timeseries.map((b) => b.avg_faithfulness)) },
    { k: 'comp', label: 'Completeness', v: s.completeness_rate ?? 0, delta: s.deltas?.completeness_rate_pp_24h ?? 0, spark: real(s.timeseries.map((b) => b.completeness_rate)) },
  ];
}

function RagHealthCard({ s, play = true }: { s: StatsResponse | undefined; play?: boolean }) {
  const metrics = rhMetrics(s);
  const hasData = metrics.length > 0 && (s?.total_traces ?? 0) > 0;
  const composite = metrics.length ? metrics.reduce((a, m) => a + m.v, 0) / metrics.length : 0;
  return (
    <div className="rh-card">
      <div className="rh-head">
        <div>
          <div className="rh-title">RAG health</div>
          <div className="rh-sub">suff · faith · comp</div>
        </div>
        <span className="rh-tag po-mono">index + 7d trend</span>
      </div>
      <div className="rh-index">
        <div className="rh-index-hero">
          <div className="rh-ih-num">{hasData ? <ScrambleNumber value={fmt2(composite)} play={play} /> : '—'}</div>
          <div className="rh-ih-l">RAG health<br /><span className="rh-ih-sub po-mono">mean of 3 · last 7d</span></div>
        </div>
        <div className="rh-index-rows">
          {metrics.map((m) => (
            <div className="rh-irow" key={m.k}>
              <span className="rh-ir-dot" style={{ background: rhColor(m.v) }} />
              <span className="rh-ir-l">{m.label}</span>
              <span className="rh-ir-spark"><Spark w={72} h={24} color={rhColor(m.v)} dot={false} values={m.spark.length >= 2 ? m.spark : [m.v, m.v]} /></span>
              <span className="rh-ir-v">{hasData ? <ScrambleNumber value={fmt2(m.v)} play={play} /> : '—'}</span>
              <MetricDelta d={m.delta} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Knowledge-gap topics — failing-query clusters (live: /insights/categories) */
const cellColor = (k: string) => `var(--cell-${k})`;
const CELL_SHORT: Record<FailureCell, string> = {
  complete_grounded: 'cg',
  complete_ungrounded: 'cu',
  incomplete_grounded: 'ig',
  incomplete_ungrounded: 'iu',
  extra_grounded: 'eg',
  extra_ungrounded: 'eu',
};
const CELL_NOTE: Record<FailureCell, string> = {
  complete_grounded: 'grounded',
  complete_ungrounded: 'hallucinated',
  incomplete_grounded: 'retrieval gap',
  incomplete_ungrounded: 'worst case',
  extra_grounded: 'padded',
  extra_ungrounded: 'hallucinated',
};

function KnowledgeGapCell({ categories, total, play = true, onTopic, onExplore }: {
  categories: CategoryInsight[];
  total: number;
  play?: boolean;
  onTopic: (cell: FailureCell | null) => void;
  onExplore: () => void;
}) {
  if (!categories.length) {
    return (
      <div className="ovc-body kg-body">
        <div className="ovc-subhead">No failing-query clusters yet</div>
        <p className="va-rationale">Topics appear here as failures are grouped into heal categories. Keep sending traces and Veralith clusters them by root cause.</p>
        <button type="button" className="ovc-link" style={LINK_BTN_RESET} onClick={onExplore}>Explore failure cells →</button>
      </div>
    );
  }
  const max = Math.max(...categories.map((c) => c.trace_count), 1);
  return (
    <div className="ovc-body kg-body">
      <div className="ovc-subhead"><ScrambleNumber value={String(total)} play={play} /> failing queries · {categories.length} topics · 7d</div>
      <div className="kg-list">
        {categories.map((c, i) => {
          const cell = c.dominant_cell;
          const short = cell ? CELL_SHORT[cell] : 'ig';
          const note = cell ? CELL_NOTE[cell] : 'failures';
          const d = c.trace_count - c.trace_count_prev;
          return (
            <div
              className="kg-row"
              key={c.suggestion_key_id}
              role="link"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => onTopic(cell)}
              onKeyDown={onActivateKey(() => onTopic(cell))}
              aria-label={`View ${c.description || c.slug} traces`}
            >
              <div className="kg-top">
                <span className="kg-dot" style={{ background: cellColor(short) }} />
                <span className="kg-name">{c.description || c.slug}</span>
                <span className="kg-q"><ScrambleNumber value={String(c.trace_count)} play={play} /></span>
                <span className={'kg-d ' + (d > 0 ? 'is-up' : d < 0 ? 'is-down' : 'is-flat')}>{d > 0 ? '+' + d : d < 0 ? d : '—'}</span>
              </div>
              <div className="kg-meta">
                <span className="kg-bar"><i style={{ width: (c.trace_count / max) * 100 + '%', background: cellColor(short), transitionDelay: i * 0.06 + 's' }} /></span>
                <span className="kg-cell" style={{ color: cellColor(short) }}>{note}</span>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="ovc-link" style={LINK_BTN_RESET} onClick={onExplore}>Explore topic clusters →</button>
    </div>
  );
}

/* Potential improvement — now → projected, + heal contributors (live, heuristic) */
type PiContributor = { name: string; gain: number; traces: number };
function PotentialImprovementCell({ current, projected, pending, contributors, play = true, onHeals }: {
  current: number;
  projected: number;
  pending: number;
  contributors: PiContributor[];
  play?: boolean;
  onHeals: () => void;
}) {
  const delta = ((projected - current) * 100).toFixed(1);
  if (pending === 0) {
    return (
      <div className="ovc-body pi-body">
        <div className="ovc-subhead">No pending heals</div>
        <p className="va-rationale">Nothing is queued to improve right now. New heal cards appear here as failures cluster, with the projected lift if you resolve them.</p>
        <button type="button" className="ovc-link" style={LINK_BTN_RESET} onClick={onHeals}>Open heals →</button>
      </div>
    );
  }
  return (
    <div className="ovc-body pi-body">
      <div className="pi-hero">
        <div className="pi-from"><span className="pi-from-n"><ScrambleNumber value={(current * 100).toFixed(1) + '%'} play={play} /></span><span className="pi-lab">now</span></div>
        <span className="pi-arrow">→</span>
        <div className="pi-to"><span className="pi-to-n"><ScrambleNumber value={(projected * 100).toFixed(1) + '%'} play={play} /></span><span className="pi-lab">if all heals done</span></div>
        <span className="pi-gain">+<ScrambleNumber value={delta} play={play} /> pp</span>
      </div>
      <div className="pi-meter">
        <div className="pi-meter-now" style={{ width: current * 100 + '%' }} />
        <div className="pi-meter-gain" style={{ left: current * 100 + '%', width: (projected - current) * 100 + '%' }} />
      </div>
      <div className="ovc-subhead">{pending} pending heals · top contributors</div>
      <div className="pi-rows">
        {contributors.map((h, i) => (
          <div
            className="pi-row"
            key={i}
            role="link"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={onHeals}
            onKeyDown={onActivateKey(onHeals)}
            aria-label={`Review heal: ${h.name}`}
          >
            <span className="pi-row-name">{h.name}</span>
            <span className="pi-row-traces po-mono">{h.traces} traces</span>
            <span className="pi-row-gain">+{h.gain.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <button type="button" className="ovc-link" style={LINK_BTN_RESET} onClick={onHeals}>Review all {pending} heals →</button>
    </div>
  );
}

/* Ver-advice — prescriptive recommendation (live: /insights/summary, LLM, cached) */
function VerAdviceCell({ summary, highlights, loading }: { summary: string; highlights: string[]; loading?: boolean }) {
  if (loading && !summary) {
    return (
      <div className="ovc-body va-body">
        <p className="va-rationale">Generating your "state of your RAG" digest…</p>
      </div>
    );
  }
  return (
    <div className="ovc-body va-body">
      <p className="va-headline">What we'd focus on next</p>
      <p className="va-rationale">{summary || 'Recommendations will appear here as your RAG accumulates evaluated traces.'}</p>
      {highlights.length > 0 && (
        <>
          <div className="va-actions-h">Recommended next, in priority order</div>
          <div className="va-actions">
            {highlights.map((a, i) => (
              <div className="va-action" key={i}>
                <span className="va-num po-mono">{i + 1}</span>
                <div className="va-action-body">
                  <div className="va-action-t">{a}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* Latency over time — detailed time-axis chart (24h / 7d), p50 + p95 + SLA (live) */
const LAT_SLA = 2.5;
type LatSeries = { p50: number[]; p95: number[]; labels: string[] };
function latSeries(s: StatsResponse | undefined, kind: '24h' | '7d'): LatSeries {
  const pts = (s?.timeseries ?? []).filter(
    (b) => b.rag_latency_p95_ms != null || b.rag_latency_p50_ms != null,
  );
  const p50 = pts.map((b) => (b.rag_latency_p50_ms ?? 0) / 1000);
  const p95 = pts.map((b) => (b.rag_latency_p95_ms ?? b.rag_latency_p50_ms ?? 0) / 1000);
  const labels = pts.map((b, i) => {
    // Only treat real ISO timestamps as dates. Mock buckets like '00'/'08'/'12'
    // otherwise parse as valid Dates (year/month) and mislabel/duplicate the axis.
    const isIso = /^\d{4}-\d{2}-\d{2}/.test(b.bucket);
    const d = new Date(b.bucket);
    if (!isIso || isNaN(d.getTime())) return b.bucket || String(i); // mock buckets ('00'…'now')
    return kind === '24h'
      ? String(d.getHours()).padStart(2, '0') + ':00'
      : d.toLocaleDateString([], { weekday: 'short' });
  });
  return { p50, p95, labels };
}

function LatencyDetailCell({ s24, s7d }: { s24: StatsResponse | undefined; s7d: StatsResponse | undefined }) {
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [hi, setHi] = useState<number | null>(null);
  const series = latSeries(range === '24h' ? s24 : s7d, range);
  const N = series.p95.length;
  if (N < 2) {
    return (
      <div className="ovc-body lat-body">
        <div className="lat-legend">
          <span className="lat-toggle">
            {(['24h', '7d'] as const).map((r) => (
              <button key={r} type="button" className={range === r ? 'is-on' : ''} onClick={() => { setRange(r); setHi(null); }}>{r}</button>
            ))}
          </span>
        </div>
        <div className="lat-insight">
          No latency captured in this window yet. It's recorded automatically when you use <code>@veralith.trace</code>, or pass <code>latency_ms</code> to <code>veralith.log()</code>.
        </div>
      </div>
    );
  }
  const W = 760, H = 232, pl = 38, pr = 16, pt = 16, pb = 30;
  const iw = W - pl - pr, ih = H - pt - pb;
  const ymax = Math.max(LAT_SLA, ...series.p95) * 1.15;
  const x = (i: number) => pl + (i / (N - 1)) * iw;
  const y = (v: number) => pt + (1 - v / ymax) * ih;
  const line = (arr: number[]) => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = (arr: number[]) => line(arr) + ' L' + x(N - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
  let peakI = 0;
  for (let i = 1; i < N; i++) if (series.p95[i] > series.p95[peakI]) peakI = i;
  const p95peak = series.p95[peakI].toFixed(1) + 's';
  const p50peak = Math.max(...series.p50).toFixed(1) + 's';
  const slowFrom = Math.max(0, peakI - 1), slowTo = Math.min(N - 1, peakI + 1);
  const tickCount = Math.min(6, N);
  const ticks = Array.from({ length: tickCount }, (_, k) => Math.round((k / (tickCount - 1)) * (N - 1)));
  const yGrid: number[] = [];
  for (let g = 1; g <= Math.floor(ymax); g++) yGrid.push(g);
  const breaches = series.p95.some((v) => v > LAT_SLA);
  const xlab = (i: number) => series.labels[i] ?? '';
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const internalX = ((e.clientX - rect.left) / rect.width) * W;
    const frac = Math.max(0, Math.min(1, (internalX - pl) / iw));
    setHi(Math.round(frac * (N - 1)));
  }
  const tipPct = hi == null ? 0 : Math.max(7, Math.min(93, (x(hi) / W) * 100));
  return (
    <div className="ovc-body lat-body">
      <div className="lat-legend">
        <span className="lat-key"><i style={{ background: 'var(--po-idle)' }} />p95<b>{p95peak}</b><small>peak</small></span>
        <span className="lat-key"><i style={{ background: 'var(--po-fg-3)' }} />p50<b>{p50peak}</b><small>peak</small></span>
        <span className="lat-key lat-key-sla"><i className="lat-dash" />SLA {LAT_SLA}s</span>
        <span className="lat-toggle">
          {(['24h', '7d'] as const).map((r) => (
            <button key={r} type="button" className={range === r ? 'is-on' : ''} onClick={() => { setRange(r); setHi(null); }}>{r}</button>
          ))}
        </span>
      </div>
      <div className="lat-plot" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        <svg className="lat-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
          {yGrid.map((g) => (
            <g key={g}>
              <line x1={pl} y1={y(g)} x2={W - pr} y2={y(g)} stroke="var(--po-line)" strokeWidth="1" />
              <text x={pl - 7} y={y(g) + 3} textAnchor="end" className="lat-ylab">{g}s</text>
            </g>
          ))}
          {slowTo > slowFrom && (
            <>
              <rect x={x(slowFrom)} y={pt} width={x(slowTo) - x(slowFrom)} height={ih} fill="color-mix(in oklab, var(--po-idle) 14%, transparent)" />
              <text x={(x(slowFrom) + x(slowTo)) / 2} y={pt + 13} textAnchor="middle" className="lat-windowlab">peak load</text>
            </>
          )}
          <line x1={pl} y1={y(LAT_SLA)} x2={W - pr} y2={y(LAT_SLA)} stroke="var(--po-bad)" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.7" />
          <path d={area(series.p95)} fill="color-mix(in oklab, var(--po-idle) 16%, transparent)" />
          <path d={line(series.p95)} fill="none" stroke="var(--po-idle)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={line(series.p50)} fill="none" stroke="var(--po-fg-3)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          {hi == null && <circle cx={x(peakI)} cy={y(series.p95[peakI])} r="3.5" fill="var(--po-idle)" stroke="var(--po-panel)" strokeWidth="2" />}
          {hi != null && (
            <g>
              <line x1={x(hi)} x2={x(hi)} y1={pt} y2={pt + ih} stroke="var(--po-line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle cx={x(hi)} cy={y(series.p95[hi])} r="3.4" fill="var(--po-idle)" stroke="var(--po-panel)" strokeWidth="2" />
              <circle cx={x(hi)} cy={y(series.p50[hi])} r="3.4" fill="var(--po-fg-3)" stroke="var(--po-panel)" strokeWidth="2" />
            </g>
          )}
          {ticks.map((i) => (
            <text key={i} x={x(i)} y={H - 9} textAnchor="middle" className="lat-xlab">{xlab(i)}</text>
          ))}
        </svg>
        {hi != null && (
          <div className="wf-chart-tip lat-tip" style={{ left: tipPct + '%', top: y(series.p95[hi]) }}>
            <span className="wf-chart-tip-x po-mono">{xlab(hi)}</span>
            <span className="lat-tip-row"><i style={{ background: 'var(--po-idle)' }} />p95 <b>{series.p95[hi].toFixed(1)}s</b></span>
            <span className="lat-tip-row"><i style={{ background: 'var(--po-fg-3)' }} />p50 <b>{series.p50[hi].toFixed(1)}s</b></span>
          </div>
        )}
      </div>
      <div className="lat-insight">
        {breaches ? (
          <>p95 peaks at <b>{p95peak}</b> and breaches the {LAT_SLA}s SLA at points in this window.</>
        ) : (
          <>p95 stays under the {LAT_SLA}s SLA, peaking at <b>{p95peak}</b>. p50 holds around <b>{p50peak}</b>.</>
        )}
      </div>
    </div>
  );
}

/* KPI cards drill down in display order: traces · failures (cells) · heals · p95 (analytics). */
const STAT_NAV = ['traces', 'cells', 'heals', 'analytics'] as const;

function TodayContent() {
  const { user } = useAuth();
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const statHref = (i: number) => {
    switch (STAT_NAV[i]) {
      case 'traces': return tracesPath(slug);
      case 'cells': return cellsPath(slug);
      case 'heals': return healsPath(slug);
      case 'analytics': return analyticsPath(slug);
    }
  };
  const firstName = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    const src = full || user?.email?.split('@')[0] || 'Alex';
    return src.split(/[\s.@]+/)[0].replace(/^\w/, (c) => c.toUpperCase());
  }, [user]);
  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const asOf = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const [period, setPeriod] = useState<PeriodId>('today');

  // ── live data ─────────────────────────────────────────────────────────────
  const projects = useProjects();
  const project = projects.data?.projects.find((p) => p.slug === slug || p.id === slug);
  const projectId = project?.id ?? null;

  const win = useMemo(() => periodWindow(period), [period]);
  const stats = useStats(slug, win);

  // Overview-grid data — fixed windows (stable per mount → stable query keys).
  const ov7d = useMemo(() => periodWindow('week'), []);
  const ov24h = useMemo(() => {
    const since = new Date();
    since.setMinutes(0, 0, 0); // floor to the hour so the key doesn't churn
    return { since: new Date(since.getTime() - 86_400_000).toISOString(), bucket: 'hour' as const };
  }, []);
  const stats7d = useStats(slug, ov7d);
  const stats24h = useStats(slug, ov24h);
  const catParams = useMemo(() => ({ since: ov7d.since, limit: 8 }), [ov7d.since]);
  const categoriesQuery = useCategoryInsights(slug, catParams);
  const summaryQuery = useInsightSummary(slug);

  const healsQuery = useQuery({
    queryKey: ['heals', projectId, 'overview'],
    queryFn: () => api.listHeals({ limit: 100 }),
    enabled: !!slug,
  });

  // For the first-run Connect block (shown when the project has no traces yet).
  const apiKeysQuery = useApiKeys(slug);
  const keyPrefix = apiKeysQuery.data?.api_keys[0]?.prefix ?? null;

  const s = stats.data;
  const projectHeals = (healsQuery.data ?? []).filter((c) => !projectId || c.project_id === projectId);
  const healsCount = projectHeals.length;

  // ── Overview grid: derived live data ──────────────────────────────────────
  const ov = stats7d.data ?? s;
  const cats = categoriesQuery.data?.categories ?? [];
  const kgTotal = cats.reduce((acc, c) => acc + c.trace_count, 0);

  // Potential improvement — heuristic projection: if every pending heal resolved,
  // its traces become healthy. Clearly labeled "if all heals done".
  // NOTE: heal n_traces is an ALL-TIME cluster size while total_traces is the 7d
  // window. To keep units honest we cap the addressable lift at the window's
  // room-for-improvement (non-healthy traces) and distribute that cap across the
  // ranked cards. This guarantees projected ≤ 100% and that the per-contributor
  // gains sum to ≤ the headline delta (no self-contradiction when the cap bites).
  const PENDING_STATUSES = new Set(['open', 'in_progress', 'pr_raised', 'failed']);
  const pendingHeals = [...projectHeals]
    .filter((c) => PENDING_STATUSES.has(c.status))
    .sort((a, b) => b.n_traces - a.n_traces);
  const ovTotal = ov?.total_traces ?? 0;
  const curHealthy = ov?.healthy_rate ?? 0;
  const healthyCount = Math.round(curHealthy * ovTotal);
  let roomLeft = Math.max(0, ovTotal - healthyCount);
  const healWithEff = pendingHeals.map((c) => {
    const eff = Math.max(0, Math.min(c.n_traces, roomLeft));
    roomLeft -= eff;
    return { card: c, eff };
  });
  const addressable = healWithEff.reduce((acc, x) => acc + x.eff, 0);
  const projHealthy = ovTotal > 0 ? (healthyCount + addressable) / ovTotal : curHealthy;
  const piContributors = healWithEff
    .slice(0, 3)
    .map((x) => ({ name: x.card.title, traces: x.card.n_traces, gain: ovTotal > 0 ? (x.eff / ovTotal) * 100 : 0 }));

  const healthyPct = (s?.healthy_rate ?? 0) * 100;
  const deltaPP = s?.deltas?.healthy_rate_pp_24h ?? 0;
  const deltaDir: 'up' | 'down' | 'flat' = deltaPP > 0.05 ? 'up' : deltaPP < -0.05 ? 'down' : 'flat';
  const tracesPct = s?.deltas?.total_traces_pct_24h ?? 0;
  const cells = s?.by_cell;
  const failures = cells
    ? (cells.complete_ungrounded ?? 0) + (cells.incomplete_ungrounded ?? 0) + (cells.extra_ungrounded ?? 0)
    : 0;
  const total = s?.total_traces ?? 0;
  // First-run signal: the project has never received a trace (all-time + 7d +
  // selected window all empty). Drives the Connect onboarding block. A project
  // that's merely quiet *today* but has 7d history keeps the normal dashboard.
  const hasAnyTraces = (project?.trace_count ?? 0) > 0 || ovTotal > 0 || total > 0;
  // Abstention-adjusted health: counting honest abstentions (correct "I don't
  // know" declines) as acceptable lifts the effective healthy rate, so a low raw
  // rate that's mostly abstentions reads as "actually fine".
  const abstained = s?.abstained_count ?? 0;
  const adjustedPct = total > 0 ? Math.min(100, healthyPct + (abstained / total) * 100) : 0;
  const showAdjusted = abstained > 0 && total > 0;
  const chartValues = (s?.timeseries ?? []).map((b) => {
    const t = b.ok + b.failed;
    return t > 0 ? b.ok / t : s?.healthy_rate ?? 0;
  });

  const kpis: StatRow[] = [
    {
      l: 'New traces',
      v: total.toLocaleString('en-US'),
      d: tracesPct > 0 ? 'up' : tracesPct < 0 ? 'down' : 'flat',
      ds: `${tracesPct >= 0 ? '+' : ''}${tracesPct.toFixed(1)}% · 24h`,
    },
    { l: 'Failures', v: failures.toLocaleString('en-US'), d: 'flat', ds: 'ungrounded · window', warn: failures > 0 },
    { l: 'Heals', v: healsCount.toLocaleString('en-US'), d: 'flat', ds: 'this project' },
    {
      l: 'p95 latency',
      v: s?.rag_latency_ms?.p95 != null ? (s.rag_latency_ms.p95 / 1000).toFixed(2) + 's' : '—',
      d: 'flat',
      ds: s?.rag_latency_ms?.p95 != null ? `p95 · ${s.rag_latency_ms.sample_size} traces` : 'no latency yet',
    },
  ];

  const asOfDate = period === 'today' ? asOf : period === 'yesterday' ? 'yesterday' : 'last 7 days';
  const asOfSub = period === 'today' ? 'live' : period === 'yesterday' ? 'all day' : '7 days';

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    function onMove(e: MouseEvent) {
      const card = (e.target as Element).closest('.wf-card, .ovc-card:not(.ovc-flush), .rh-card') as HTMLElement | null;
      if (!card || !root!.contains(card)) return;
      const r = card.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      let ang = (Math.atan2(dx, -dy) * 180) / Math.PI; // clockwise from top
      if (ang < 0) ang += 360;
      card.style.setProperty('--b2angle', ang + 'deg');
    }
    root.addEventListener('mousemove', onMove);
    return () => root.removeEventListener('mousemove', onMove);
  }, []);

  // Overview is below the fold — replay the draw-in + scramble when it scrolls into view (once).
  const [ovRef, ovInView] = useInView();

  return (
    <div className="wf-page wf-b2 is-glow" ref={rootRef}>
      <section className="wf-today">
        <div className="wf-today-head">
          <div>
            <div className="wf-greet">{greet}, <b>{firstName}</b></div>
            <h1 className="wf-h1 wf-period">
              {PERIOD_TABS.map((t) => (
                <button key={t.id} type="button" className={'wf-period-tab' + (period === t.id ? ' is-active' : '')} onClick={() => setPeriod(t.id)}>{t.label}</button>
              ))}
            </h1>
          </div>
        </div>

        {/* First-run: no traces ever → lead with the Connect steps, above the
            empty healthy-rate chart + KPI grid. */}
        {s && !hasAnyTraces && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <ConnectCards apiKey={keyPrefix} />
          </div>
        )}

        {stats.isError ? (
          <ErrorState
            message={stats.error instanceof Error ? stats.error.message : 'Failed to load your overview.'}
            onRetry={() => stats.refetch()}
          />
        ) : !s ? (
          <LoadingState label="Loading your overview…" />
        ) : (
          <div className="wf-b-grid">
            <div className="wf-b-pulse wf-card">
              <div className="wf-mlabel">Healthy rate · <HealthBadge pct={healthyPct} hasData={total > 0} /></div>
              <div className="wf-num" style={{ fontSize: 52 }}>
                {total > 0 ? <ScrambleNumber value={`${healthyPct.toFixed(1)}%`} /> : '—'}
              </div>
              <div className="wf-metric-sub">
                {total > 0 ? (
                  <Delta dir={deltaDir}>{`${Math.abs(deltaPP).toFixed(1)}pp vs 24h ago`}</Delta>
                ) : (
                  <span className="wf-metric-muted">No traces in this window yet</span>
                )}
              </div>
              {showAdjusted && (
                <div
                  className="wf-abstain-line"
                  title="Honest abstentions — the model correctly declined ('I don't know') instead of fabricating. Counting them as acceptable gives the effective healthy rate."
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 6.2l2.3 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <b>{adjustedPct.toFixed(1)}%</b> effective · incl. {abstained} honest abstention{abstained === 1 ? '' : 's'}
                </div>
              )}
              {total > 0 ? (
                <BigChart
                  h={150}
                  color={healthyPct >= 85 ? 'var(--po-live)' : healthyPct >= 70 ? 'var(--po-idle)' : 'var(--po-bad)'}
                  cap={`// healthy rate · ${win.bucket === 'day' ? 'daily' : 'hourly'}`}
                  l={period === 'week' ? '7d ago' : '12:00 AM'}
                  r="now"
                  values={chartValues.length ? chartValues : [s.healthy_rate, s.healthy_rate]}
                  fmt={(v) => (v * 100).toFixed(0) + '%'}
                  yticks={[100, 75, 50].map((p) => ({ v: p / 100, label: p + '%' }))}
                />
              ) : (
                <div className="wf-chart-empty" style={{ height: 150 }}>
                  Healthy rate will chart here once traces arrive.
                </div>
              )}
            </div>

            <div className="wf-b-right">
              <div className="wf-asof">
                <span className="wf-asof-pre">as of</span>
                <span className="wf-asof-main"><b>{asOfDate}</b> · {asOfSub}</span>
              </div>
              <div className="wf-b-stats">
                {kpis.map((k, i) => (
                  <div
                    className="wf-b-stat wf-card"
                    key={i}
                    role="link"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(statHref(i))}
                    onKeyDown={onActivateKey(() => navigate(statHref(i)))}
                    aria-label={`View ${k.l}`}
                  >
                    <span className="wf-mlabel">{k.l}</span>
                    <span className={'wf-num' + (k.warn ? ' wf-warn' : '')}><ScrambleNumber value={k.v} /></span>
                    <Delta dir={k.d}>{k.ds}</Delta>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Profile + Overview only mount once stats are loaded, so the page shows
          a single loader (no second donut loader) during the initial load. */}
      {s && hasAnyTraces && (
      <>
      <section className="wf-profile-sec">
        <div className="wf-card wf-profile">
          <div className="ovc-head">
            <div className="ovc-title">Trace health profile</div>
            <span className="ovc-tag po-mono">failure-cell mix · achievements</span>
          </div>
          <div className="wf-profile-body">
            <div className="wf-profile-donut">
              {cells ? (
                <HealthDonut counts={cells} onCellClick={(cell) => navigate(tracesPath(slug, cell))} />
              ) : null}
            </div>
            <div className="wf-profile-side">
              <ProfileBadges
                totalTraces={total}
                hallucinationRate={total > 0 ? failures / total : 0}
                healsResolved={projectHeals.filter((c) => c.status === 'resolved').length}
                healsOpen={pendingHeals.length}
              />
            </div>
          </div>
        </div>
      </section>

      <section className={'wf-overview' + (ovInView ? ' is-revealed' : '')} ref={ovRef}>
        <div className="wf-ov-head">
          <h2 className="wf-h2">Overview</h2>
          <div className="wf-ov-actions"><span className="ovc-chip">Last 7 days ⌄</span><span className="ovc-chip">✎ Edit</span></div>
        </div>

        <div className="ovc-cols">
          <div className="ovc-col ovc-col-l">
            <div className="ovc-card ovc-flush"><RagHealthCard s={stats7d.data} play={ovInView} /></div>
            <OvCell title="Latency over time" sub="p50 · p95 · 24h / 7d"><LatencyDetailCell s24={stats24h.data} s7d={stats7d.data} /></OvCell>
            <OvCell title="Ver-advice" sub="what we'd do next"><VerAdviceCell summary={summaryQuery.data?.summary ?? ''} highlights={summaryQuery.data?.highlights ?? []} loading={summaryQuery.isLoading} /></OvCell>
          </div>
          <div className="ovc-col ovc-col-r">
            <OvCell title="Knowledge-gap topics" sub="failing-query clusters"><KnowledgeGapCell categories={cats} total={kgTotal} play={ovInView} onTopic={(cell) => navigate(cell ? tracesPath(slug, cell) : tracesPath(slug))} onExplore={() => navigate(cellsPath(slug))} /></OvCell>
            <OvCell title="Potential improvement" sub="if all heals done" grow><PotentialImprovementCell current={curHealthy} projected={projHealthy} pending={pendingHeals.length} contributors={piContributors} play={ovInView} onHeals={() => navigate(healsPath(slug))} /></OvCell>
          </div>
        </div>
      </section>
      </>
      )}
    </div>
  );
}

export default function TodayOverview() {
  const { slug = '' } = useParams<{ slug: string }>();
  const projects = useProjects();
  const project = useMemo(
    () => projects.data?.projects.find((p) => p.slug === slug || p.id === slug),
    [projects.data, slug],
  );
  const projectName = project?.name ?? slug;

  return (
    <ProjectShell slug={slug} active="overview" project={projectName}>
      <TodayContent />
    </ProjectShell>
  );
}
