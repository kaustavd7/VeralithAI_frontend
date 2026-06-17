import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useProjects } from '../hooks/useProjects';
import { useCellTimeseries } from '../hooks/useOverviewData';
import type { CellTimeseriesResponse, FailureCell } from '../api/types';
import { tracesPath } from '../lib/nav';
import '../styles/failure-cells.css';

/* ─────────────────────────────────────────────────────────────────────────
   Failure Cells — /projects/:slug/analytics/cells

   The 2×3 grounded/ungrounded × complete/incomplete/extra taxonomy over time.
   Hand-rolled SVG charts (no chart lib). Data comes from
   GET /v1/projects/{id}/analytics/cells/timeseries → per-bucket per-cell
   counts (useCellTimeseries). The window is resolved to a STABLE, minute-
   quantized `since` so the react-query key doesn't churn every render.
   ───────────────────────────────────────────────────────────────────────── */

type FcGrouping = 'cells' | 'completeness';
type FcChartKind = 'bar' | 'line';
type FcScale = 'count' | 'share';
type FcRange = '1h' | '6h' | '24h' | '7d' | '30d';
type FcGroupKey = 'chart' | 'grouping' | 'scale' | 'range';
type FcFlagKey = 'smooth' | 'threshold';

interface FcState {
  chart: FcChartKind;
  grouping: FcGrouping;
  scale: FcScale;
  range: FcRange;
  smooth: boolean;
  threshold: boolean;
  hidden: Set<string>;
}

interface FcCell {
  key: FailureCell;
  label: string;
  comp: 'complete' | 'incomplete' | 'extra';
  ground: 'grounded' | 'ungrounded';
  color: string;
  healthy: boolean;
}

interface FcSeries {
  key: string;
  label: string;
  color: string;
  members: FailureCell[];
}

type Pt = [number, number];

/* ── cell model ─────────────────────────────────────────────────────────── */

// sage ramp — light (healthy, dominant) → dark (worst case), matching the bubble chart
const FC_CELLS: FcCell[] = [
  { key: 'complete_grounded',     label: 'complete · grounded',     comp: 'complete',   ground: 'grounded',   color: 'var(--fcell-cg)', healthy: true  },
  { key: 'incomplete_grounded',   label: 'incomplete · grounded',   comp: 'incomplete', ground: 'grounded',   color: 'var(--fcell-ig)', healthy: false },
  { key: 'extra_grounded',        label: 'extra · grounded',        comp: 'extra',      ground: 'grounded',   color: 'var(--fcell-eg)', healthy: false },
  { key: 'complete_ungrounded',   label: 'complete · ungrounded',   comp: 'complete',   ground: 'ungrounded', color: 'var(--fcell-cu)', healthy: false },
  { key: 'extra_ungrounded',      label: 'extra · ungrounded',      comp: 'extra',      ground: 'ungrounded', color: 'var(--fcell-eu)', healthy: false },
  { key: 'incomplete_ungrounded', label: 'incomplete · ungrounded', comp: 'incomplete', ground: 'ungrounded', color: 'var(--fcell-iu)', healthy: false },
];

const FC_GROUPINGS: Record<FcGrouping, FcSeries[]> = {
  cells: FC_CELLS.map((c) => ({ key: c.key, label: c.label, color: c.color, members: [c.key] })),
  completeness: [
    { key: 'complete',   label: 'complete',   color: 'var(--fcell-cg)', members: FC_CELLS.filter((c) => c.comp === 'complete').map((c) => c.key) },
    { key: 'incomplete', label: 'incomplete', color: 'var(--fcell-eg)', members: FC_CELLS.filter((c) => c.comp === 'incomplete').map((c) => c.key) },
    { key: 'extra',      label: 'extra',      color: 'var(--fcell-iu)', members: FC_CELLS.filter((c) => c.comp === 'extra').map((c) => c.key) },
  ],
};

const FC_RANGES: Record<FcRange, number> = {
  '1h': 3600e3,
  '6h': 6 * 3600e3,
  '24h': 24 * 3600e3,
  '7d': 7 * 864e5,
  '30d': 30 * 864e5,
};

function bucketForRange(range: FcRange): 'hour' | 'day' {
  return range === '7d' || range === '30d' ? 'day' : 'hour';
}

// Quantize "now" to the start of the current minute so successive renders share
// the SAME `since` string. Without this the react-query key changes every render
// → infinite refetch loop that hammers the backend.
function sinceForRange(range: FcRange): string {
  const QUANTUM = 60_000;
  const now = Math.floor(Date.now() / QUANTUM) * QUANTUM;
  return new Date(now - FC_RANGES[range]).toISOString();
}

/* ── per-cell series derived from the API buckets ───────────────────────── */

interface FcBucket {
  t: number; // bucket start, ms epoch
  counts: Record<FailureCell, number>;
}

interface FcModel {
  buckets: FcBucket[];
  totals: Record<FailureCell, number>;
  total: number;
}

const ZERO_TOTALS: Record<FailureCell, number> = {
  complete_grounded: 0,
  complete_ungrounded: 0,
  incomplete_grounded: 0,
  incomplete_ungrounded: 0,
  extra_grounded: 0,
  extra_ungrounded: 0,
};

function buildModel(data: CellTimeseriesResponse | undefined): FcModel {
  if (!data) return { buckets: [], totals: { ...ZERO_TOTALS }, total: 0 };
  const buckets: FcBucket[] = data.buckets.map((b) => ({
    t: Date.parse(b.bucket),
    counts: { ...ZERO_TOTALS, ...b.cells },
  }));
  return {
    buckets,
    totals: { ...ZERO_TOTALS, ...data.totals },
    total: data.total,
  };
}

// Sum a series' member cells across the whole window.
function seriesTotal(model: FcModel, s: FcSeries): number {
  return s.members.reduce((acc, m) => acc + (model.totals[m] ?? 0), 0);
}

/* ── formatting ─────────────────────────────────────────────────────────── */

const FC_M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fcPad = (n: number) => String(n).padStart(2, '0');
const fcNum = (n: number) => (n >= 1000 ? Math.round(n).toLocaleString() : String(Math.round(n)));
const fcR1 = (n: number) => Math.round(n * 10) / 10;
function fcXLabel(ts: number, range: FcRange): string {
  const d = new Date(ts);
  return range === '7d' || range === '30d'
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${fcPad(d.getHours())}:${fcPad(d.getMinutes())}`;
}
function fcFullTime(ts: number): string {
  const d = new Date(ts);
  return `${FC_M[d.getMonth()]} ${d.getDate()} · ${fcPad(d.getHours())}:${fcPad(d.getMinutes())}`;
}

/* ── monotone-cubic spline ──────────────────────────────────────────────── */

function fcMono(pts: Pt[]): string {
  const n = pts.length;
  if (n < 2) return n ? `M ${pts[0][0]} ${pts[0][1]}` : '';
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const dx: number[] = [];
  const dl: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    dl[i] = (ys[i + 1] - ys[i]) / (dx[i] || 1e-6);
  }
  const m = new Array(n);
  m[0] = dl[0];
  m[n - 1] = dl[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = dl[i - 1] * dl[i] <= 0 ? 0 : (dl[i - 1] + dl[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (dl[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / dl[i];
    const b = m[i + 1] / dl[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * dl[i];
      m[i + 1] = t * b * dl[i];
    }
  }
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    d += ` C ${xs[i] + h / 3} ${ys[i] + (m[i] * h) / 3}, ${xs[i + 1] - h / 3} ${ys[i + 1] - (m[i + 1] * h) / 3}, ${xs[i + 1]} ${ys[i + 1]}`;
  }
  return d;
}

/* ── sparkline ──────────────────────────────────────────────────────────── */

let fcSpkSeq = 0;
function FcSpark({ vals, color, fill = true }: { vals: number[]; color: string; fill?: boolean }) {
  const W = 100;
  const H = 38;
  const gid = useMemo(() => 'fcsp' + (fcSpkSeq++).toString(36), []);
  if (vals.length < 2) {
    return <svg className="fc-spk" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" />;
  }
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const rng = mx - mn || 1;
  const pts: Pt[] = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 2 - ((v - mn) / rng) * (H - 6)]);
  const line = fcMono(pts);
  return (
    <svg className="fc-spk" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={line + ` L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/* ── main chart ─────────────────────────────────────────────────────────── */

type Hover = { idx: number; x: number; w: number } | null;

function FcChart({ state, model }: { state: FcState; model: FcModel }) {
  const [hover, setHover] = useState<Hover>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  const series = FC_GROUPINGS[state.grouping].filter((s) => !state.hidden.has(s.key));
  const isShare = state.scale === 'share';

  // One column per real bucket. `raw[si][i]` = series si's count in bucket i.
  const cats = model.buckets.map((b) => b.t);
  const N = cats.length;
  const raw: number[][] = series.map((s) =>
    model.buckets.map((b) => s.members.reduce((acc, m) => acc + (b.counts[m] ?? 0), 0)),
  );
  const colTot = cats.map((_, i) => series.reduce((a, _s, si) => a + raw[si][i], 0));

  const valAt = (si: number, i: number) => (isShare ? (colTot[i] ? (raw[si][i] / colTot[i]) * 100 : 0) : raw[si][i]);

  let yMax: number;
  if (isShare) yMax = 100;
  else if (state.chart === 'bar') yMax = Math.max(1, ...colTot);
  else yMax = Math.max(1, ...series.map((_s, si) => Math.max(0, ...raw[si])));
  const niceStep = (mv: number) => {
    const p = Math.pow(10, Math.floor(Math.log10(mv / 4 || 1)));
    const c = mv / 4 / p;
    const s = c <= 1 ? 1 : c <= 2 ? 2 : c <= 5 ? 5 : 10;
    return s * p;
  };
  const step = isShare ? 25 : niceStep(yMax);
  yMax = isShare ? 100 : Math.ceil(yMax / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax + 1e-6; v += step) ticks.push(v);

  const padX = state.chart === 'bar' ? 1.2 : 0;
  const denom = state.chart === 'bar' ? N : Math.max(1, N - 1);
  const xAt = (i: number) => padX + ((i + (state.chart === 'bar' ? 0.5 : 0)) / denom) * (100 - padX * 2);
  const yAt = (v: number) => 100 - (v / yMax) * 100;
  const barW = N > 0 ? ((100 - padX * 2) / N) * 0.7 : 0;

  function onMove(e: React.MouseEvent) {
    if (!plotRef.current || N === 0) return;
    const r = plotRef.current.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    let idx = Math.round(fx * (state.chart === 'bar' ? N : N - 1) - (state.chart === 'bar' ? 0.5 : 0));
    idx = Math.max(0, Math.min(N - 1, idx));
    setHover({ idx, x: e.clientX - r.left, w: r.width });
  }

  const sloShare = isShare && state.threshold;

  return (
    <div className="fc-chart">
      <div className="fc-yaxis">
        {ticks.map((v) => (
          <span key={v} className="fc-ytick" style={{ top: yAt(v) + '%' }}>
            {isShare ? v + '%' : v >= 1000 ? v / 1000 + 'k' : Math.round(v)}
          </span>
        ))}
      </div>

      <div className="fc-plot" ref={plotRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          {ticks.map((v) => (
            <line key={v} x1="0" x2="100" y1={yAt(v)} y2={yAt(v)} stroke="var(--po-line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" opacity="0.7" />
          ))}

          {state.chart === 'bar'
            ? cats.map((_tc, i) => {
                let acc = 0;
                return (
                  <g key={i}>
                    {series.map((s, si) => {
                      const v = valAt(si, i);
                      if (v <= 0) return null;
                      const h = (v / yMax) * 100;
                      const y = yAt(acc + v);
                      acc += v;
                      return <rect key={s.key} x={xAt(i) - barW / 2} width={barW} y={y} height={Math.max(0, h)} fill={s.color} opacity={hover && hover.idx === i ? 1 : 0.92} />;
                    })}
                  </g>
                );
              })
            : (
              <>
                {series.map((s, si) => {
                  const pts: Pt[] = cats.map((_tc, i) => [xAt(i), yAt(valAt(si, i))]);
                  const d = state.smooth ? fcMono(pts) : 'M ' + pts.map((p) => p[0] + ' ' + p[1]).join(' L ');
                  return <path key={s.key + '-a'} d={d + ` L ${xAt(N - 1)} 100 L ${xAt(0)} 100 Z`} fill={s.color} opacity="0.10" />;
                })}
                {series.map((s, si) => {
                  const pts: Pt[] = cats.map((_tc, i) => [xAt(i), yAt(valAt(si, i))]);
                  const d = state.smooth ? fcMono(pts) : 'M ' + pts.map((p) => p[0] + ' ' + p[1]).join(' L ');
                  return <path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />;
                })}
              </>
            )}

          {sloShare && <line x1="0" x2="100" y1={yAt(90)} y2={yAt(90)} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.85" />}
          {hover && <line x1={xAt(hover.idx)} x2={xAt(hover.idx)} y1="0" y2="100" stroke="var(--po-fg-3)" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" opacity="0.5" />}
        </svg>

        {sloShare && <span className="fc-slo-tag" style={{ top: yAt(90) + '%' }}>Healthy SLO 90%</span>}

        {hover &&
          (() => {
            const i = hover.idx;
            const rows = series.map((s, si) => ({ name: s.label, color: s.color, v: valAt(si, i) })).reverse();
            const total = colTot[i];
            const flip = hover.x > hover.w * 0.6;
            return (
              <div className="fc-tip" style={{ left: hover.x + (flip ? -12 : 12) + 'px', transform: flip ? 'translateX(-100%)' : 'none' }}>
                <div className="fc-tip-head">{fcFullTime(cats[i])}</div>
                {rows.map((r) => (
                  <div key={r.name} className="fc-tip-row">
                    <span className="fc-tip-dot" style={{ background: r.color }} />
                    <span className="fc-tip-name">{r.name}</span>
                    <span className="fc-tip-val">{isShare ? fcR1(r.v) + '%' : fcNum(r.v)}</span>
                  </div>
                ))}
                {!isShare && <div className="fc-tip-total">Σ {fcNum(total)} traces · bucket</div>}
              </div>
            );
          })()}
      </div>

      <div className="fc-xaxis">
        {cats.map((tc, i) => i % Math.max(1, Math.ceil(N / 8)) === 0 && (
          <span key={i} className="fc-xtick" style={{ left: xAt(i) + '%' }}>{fcXLabel(tc, state.range)}</span>
        ))}
      </div>
    </div>
  );
}

/* ── page body ──────────────────────────────────────────────────────────── */

function FailureCellsPage({ projectId, slug }: { projectId: string; slug: string }) {
  const navigate = useNavigate();
  // Drill-down: a failure cell → the Trace Explorer pre-filtered to that cell.
  const goToCell = (cellKey: string) => navigate(tracesPath(slug, cellKey));
  const onCellKey = (cellKey: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToCell(cellKey);
    }
  };

  const [state, setState] = useState<FcState>({
    chart: 'bar',
    grouping: 'cells',
    scale: 'count',
    range: '24h',
    smooth: true,
    threshold: true,
    hidden: new Set<string>(),
  });
  const set = (patch: Partial<FcState>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      if (patch.grouping || patch.chart) next.hidden = new Set<string>();
      return next;
    });
  const toggleHidden = (key: string) =>
    setState((s) => {
      const h = new Set(s.hidden);
      if (h.has(key)) h.delete(key);
      else h.add(key);
      return { ...s, hidden: h };
    });

  // STABLE minute-quantized window params → stable react-query key (no refetch loop).
  const params = useMemo(
    () => ({ since: sinceForRange(state.range), bucket: bucketForRange(state.range) }),
    [state.range],
  );
  const query = useCellTimeseries(projectId, params);
  const model = useMemo(() => buildModel(query.data), [query.data]);

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (model.total === 0) {
    return (
      <EmptyState
        title="No failure cells yet"
        sub="Once your traces are evaluated, the grounded × complete taxonomy over time shows up here."
        action={
          <Link to={`/projects/${slug}`} className="po-btn po-btn-ghost">
            Connect your project
          </Link>
        }
      />
    );
  }

  // Window-level headline: healthy share = complete·grounded / total.
  const totalAll = model.total;
  const healthyPct = totalAll ? (model.totals.complete_grounded / totalAll) * 100 : 0;
  const hbad = healthyPct < 90;

  // Render helpers (plain functions, not components — avoids remounting on every
  // render and the react-hooks/static-components lint rule).
  const seg = (group: FcGroupKey, opts: [string, string, boolean?][]) => (
    <div className="fc-seg">
      {opts.map(([val, label, disabled]) => (
        <button
          key={val}
          className={(state[group] === val ? 'is-active' : '') + (disabled ? ' is-disabled' : '')}
          disabled={disabled}
          onClick={() => !disabled && set({ [group]: val } as Partial<FcState>)}
        >
          {label}
        </button>
      ))}
    </div>
  );
  const tog = (flag: FcFlagKey, label: string, ok: boolean) => (
    <button className={'fc-tog' + (state[flag] && ok ? ' is-on' : '') + (!ok ? ' is-disabled' : '')} disabled={!ok} onClick={() => ok && set({ [flag]: !state[flag] } as Partial<FcState>)}>
      <span className="fc-sw" />
      {label}
    </button>
  );

  return (
    <div className="fc-page">
      <div className="fc-head">
        <div>
          <div className="fc-kicker">Trace quality · last {state.range}</div>
          <h1 className="fc-h1">Failure cells</h1>
        </div>
        <div className="fc-hero">
          <span className={'fc-hero-num' + (hbad ? ' is-bad' : '')}>{fcR1(healthyPct)}%</span>
          <div className="fc-hero-lab">
            <span>healthy</span>
            <span className={'fc-tgt' + (hbad ? ' is-miss' : '')}>{hbad ? 'below 90% ✗' : 'target 90% ✓'}</span>
          </div>
        </div>
      </div>

      <div className="fc-controls">
        <div className="fc-cgrp">
          <span className="fc-kicker">Chart</span>
          {seg('chart', [['bar', 'Bars'], ['line', 'Lines']])}
        </div>
        <div className="fc-cgrp">
          <span className="fc-kicker">Group by</span>
          {seg('grouping', [['cells', '6 cells'], ['completeness', 'Completeness']])}
        </div>
        <div className="fc-cgrp">
          <span className="fc-kicker">Scale</span>
          {seg('scale', [['count', 'Count'], ['share', 'Share %']])}
        </div>
        <div className="fc-cgrp">
          <span className="fc-kicker">Window</span>
          {seg('range', [['1h', '1h'], ['6h', '6h'], ['24h', '24h'], ['7d', '7d'], ['30d', '30d']])}
        </div>
        <div className="fc-cgrp">
          <span className="fc-kicker">Options</span>
          <div className="fc-toggles">
            {tog('smooth', 'Smooth', state.chart === 'line')}
            {tog('threshold', 'SLO line', state.scale === 'share')}
          </div>
        </div>
      </div>

      <div className="fc-chartcard">
        <div className="fc-chead">
          <span className="fc-cdesc">
            <b>{state.chart === 'bar' ? 'Bars' : 'Lines'}</b> · {state.grouping === 'cells' ? '6 distinct cells' : 'complete · incomplete · extra'} · {state.scale === 'share' ? 'share of traces' : 'count per bucket'}
          </span>
          <div className="fc-legend">
            {FC_GROUPINGS[state.grouping].map((s) => {
              const cnt = seriesTotal(model, s);
              const off = state.hidden.has(s.key);
              // Only the 6-cell grouping's series keys map to real failure cells.
              const cell = state.grouping === 'cells' ? (s.key as FailureCell) : undefined;
              return (
                <button key={s.key} className={'fc-lg' + (off ? ' is-off' : '')} onClick={() => toggleHidden(s.key)}>
                  <span className="fc-lg-d" style={{ background: s.color }} />
                  {s.label}
                  <span className="fc-lg-c">{fcNum(cnt)}</span>
                  {cell && (
                    <span
                      className="fc-lg-drill"
                      role="link"
                      tabIndex={0}
                      aria-label={`View ${s.label} traces`}
                      title={`View ${s.label} traces`}
                      style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 700 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        goToCell(cell);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        onCellKey(cell)(e);
                      }}
                    >
                      →
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <FcChart state={state} model={model} />
      </div>

      <div className="fc-breakout">
        <div className="fc-breakhead">
          <h2>
            Break out cells <span>· trailing {state.range}</span>
          </h2>
        </div>
        <div className="fc-smgrid">
          {FC_CELLS.map((c) => {
            const tot = model.totals[c.key] ?? 0;
            const vals = model.buckets.map((b) => b.counts[c.key] ?? 0);
            return (
              <button
                key={c.key}
                className="fc-sm"
                onClick={() => set({ chart: 'line', grouping: 'cells', hidden: new Set(FC_CELLS.filter((x) => x.key !== c.key).map((x) => x.key)) })}
              >
                <div className="fc-sm-h">
                  <span className="fc-sm-d" style={{ background: c.color }} />
                  <span className="fc-sm-nm">{c.label}</span>
                  <span className={'fc-sm-tag' + (c.healthy ? '' : ' is-fail')}>{c.healthy ? 'healthy' : 'failure'}</span>
                </div>
                <div className="fc-sm-row">
                  <span className="fc-sm-c" style={{ color: c.color }}>{fcNum(tot)}</span>
                  <span className="fc-sm-sh">{fcR1((tot / (totalAll || 1)) * 100)}%</span>
                </div>
                <FcSpark vals={vals} color={c.color} />
                <span
                  className="fc-sm-drill"
                  role="link"
                  tabIndex={0}
                  aria-label={`View ${c.label} traces`}
                  style={{
                    cursor: 'pointer',
                    display: 'inline-block',
                    marginTop: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    color: 'var(--accent)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToCell(c.key);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    onCellKey(c.key)(e);
                  }}
                >
                  View traces →
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function FailureCells() {
  const { slug = '' } = useParams<{ slug: string }>();
  const projects = useProjects();
  const project = useMemo(() => projects.data?.projects.find((p) => p.slug === slug || p.id === slug), [projects.data, slug]);
  const projectName = project?.name ?? slug;
  return (
    <ProjectShell slug={slug} active="cells" project={projectName}>
      {projects.isPending ? (
        <LoadingState />
      ) : projects.isError ? (
        <ErrorState
          message={projects.error instanceof Error ? projects.error.message : undefined}
          onRetry={() => projects.refetch()}
        />
      ) : !project ? (
        <EmptyState title="Project not found" sub="This project may have been deleted, or the URL is incorrect." />
      ) : (
        <FailureCellsPage projectId={project.id} slug={slug} />
      )}
    </ProjectShell>
  );
}
