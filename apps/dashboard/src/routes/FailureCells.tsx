import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import '../styles/failure-cells.css';

/* ─────────────────────────────────────────────────────────────────────────
   Failure Cells — /projects/:slug/analytics/cells

   The 2×3 grounded/ungrounded × complete/incomplete/extra taxonomy over time.
   Hand-rolled SVG charts (no chart lib). The time-bucketed per-cell data is a
   DETERMINISTIC synthetic generator (fcRateAt) seeded by (cellKey, ts, seed) —
   there is no backend endpoint for time-bucketed cell counts yet. When one
   ships (GET /projects/:slug/analytics/cells/timeseries → per-bucket per-cell
   counts), replace fcSampleWin / fcWindowStats / fcCellWindow with fetches and
   drop the `seed` / Reseed control. See the cell-key map note below.
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
  seed: number;
  za: number;
  zb: number;
}

interface FcCell {
  key: string;
  label: string;
  comp: 'complete' | 'incomplete' | 'extra';
  ground: 'grounded' | 'ungrounded';
  color: string;
  healthy: boolean;
  base: number;
  idx: number;
}

interface FcSeries {
  key: string;
  label: string;
  color: string;
  members: string[];
}

type Pt = [number, number];

/* ── deterministic model ────────────────────────────────────────────────── */

function fcHash(a: number, b: number, c: number): number {
  let h = 2166136261 >>> 0;
  [a, b, c].forEach((x) => {
    h ^= x;
    h = Math.imul(h, 16777619);
  });
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// sage ramp — light (healthy, dominant) → dark (worst case), matching the bubble chart
const FC_CELLS: FcCell[] = [
  { key: 'cg', label: 'complete · grounded',     comp: 'complete',   ground: 'grounded',   color: '#DAD7CD', healthy: true,  base: 1100 / 24, idx: 0 },
  { key: 'ig', label: 'incomplete · grounded',   comp: 'incomplete', ground: 'grounded',   color: '#A3B18A', healthy: false, base: 93 / 24,   idx: 1 },
  { key: 'eg', label: 'extra · grounded',        comp: 'extra',      ground: 'grounded',   color: '#76936A', healthy: false, base: 53 / 24,   idx: 2 },
  { key: 'cu', label: 'complete · ungrounded',   comp: 'complete',   ground: 'ungrounded', color: '#588157', healthy: false, base: 24 / 24,   idx: 3 },
  { key: 'eu', label: 'extra · ungrounded',      comp: 'extra',      ground: 'ungrounded', color: '#3A5A40', healthy: false, base: 7 / 24,    idx: 4 },
  { key: 'iu', label: 'incomplete · ungrounded', comp: 'incomplete', ground: 'ungrounded', color: '#344E41', healthy: false, base: 2 / 24,    idx: 5 },
];
const FC_MAP: Record<string, FcCell> = Object.fromEntries(FC_CELLS.map((c) => [c.key, c]));

const FC_GROUPINGS: Record<FcGrouping, FcSeries[]> = {
  cells: FC_CELLS.map((c) => ({ key: c.key, label: c.label, color: c.color, members: [c.key] })),
  completeness: [
    { key: 'complete',   label: 'complete',   color: '#DAD7CD', members: FC_CELLS.filter((c) => c.comp === 'complete').map((c) => c.key) },
    { key: 'incomplete', label: 'incomplete', color: '#76936A', members: FC_CELLS.filter((c) => c.comp === 'incomplete').map((c) => c.key) },
    { key: 'extra',      label: 'extra',      color: '#344E41', members: FC_CELLS.filter((c) => c.comp === 'extra').map((c) => c.key) },
  ],
};

const FC_RANGES: Record<FcRange, number> = {
  '1h': 3600e3,
  '6h': 6 * 3600e3,
  '24h': 24 * 3600e3,
  '7d': 7 * 864e5,
  '30d': 30 * 864e5,
};
const FC_ORIGIN = Date.UTC(2026, 4, 31, 14, 0, 0); // fixed "now" so the canvas is stable
const FC_INC: { c: number; w: number; mult: Record<string, number> }[] = [
  { c: FC_ORIGIN - 2 * 864e5,   w: 6 * 60, mult: { cu: 3.6, eu: 5, iu: 3 } },
  { c: FC_ORIGIN - 9 * 864e5,   w: 5 * 60, mult: { ig: 3, iu: 2.4 } },
  { c: FC_ORIGIN - 19 * 864e5,  w: 8 * 60, mult: { eg: 2.4, eu: 3 } },
  { c: FC_ORIGIN - 14 * 3600e3, w: 80,     mult: { cu: 2.6, eu: 3.6 } },
];

function fcRateAt(cell: FcCell, ts: number, seed: number): number {
  const dayPhase = (((ts % 864e5) + 864e5) % 864e5) / 864e5;
  const daily = 0.6 + 0.4 * Math.sin((dayPhase - 0.28) * 2 * Math.PI);
  const week = 0.92 + 0.08 * Math.sin(((ts % (7 * 864e5)) / (7 * 864e5)) * 2 * Math.PI);
  let r = cell.base * (0.8 + 0.4 * daily) * week;
  for (const inc of FC_INC) {
    const m = inc.mult[cell.key];
    if (m) {
      const g = Math.exp(-0.5 * Math.pow((ts - inc.c) / (inc.w * 60000), 2));
      r *= 1 + (m - 1) * g;
    }
  }
  const nb = Math.floor(ts / 600000);
  r *= 0.74 + 0.52 * fcHash(nb, cell.idx, seed);
  return Math.max(0, r);
}

/* ── aggregation / sampling ─────────────────────────────────────────────── */

function fcSampleWin(series: FcSeries[], tStart: number, tEnd: number, N: number, seed: number) {
  const dt = (tEnd - tStart) / N;
  const dtH = dt / 3600e3;
  const cats: number[] = [];
  const raw: number[][] = series.map(() => []);
  for (let i = 0; i < N; i++) {
    const tc = tStart + dt * (i + 0.5);
    cats.push(tc);
    series.forEach((s, si) => {
      let v = 0;
      s.members.forEach((m) => (v += fcRateAt(FC_MAP[m], tc, seed)));
      raw[si].push(v * dtH);
    });
  }
  return { cats, raw };
}

function fcWindowStats(now: number, span: number, seed: number) {
  const K = 200;
  const dt = span / K;
  const dtH = dt / 3600e3;
  let tot = 0;
  let cg = 0;
  let ung = 0;
  for (let i = 0; i < K; i++) {
    const tc = now - span + dt * (i + 0.5);
    for (const c of FC_CELLS) {
      const v = fcRateAt(c, tc, seed) * dtH;
      tot += v;
      if (c.key === 'cg') cg += v;
      if (c.ground === 'ungrounded') ung += v;
    }
  }
  return { total: tot, healthyPct: tot ? (cg / tot) * 100 : 0, ungroundedPct: tot ? (ung / tot) * 100 : 0, failures: tot - cg };
}

function fcCellWindow(key: string, span: number, seed: number, N = 48) {
  const now = FC_ORIGIN;
  const dt = span / N;
  const dtH = dt / 3600e3;
  const vals: number[] = [];
  let tot = 0;
  for (let i = 0; i < N; i++) {
    const tc = now - span + dt * (i + 0.5);
    const v = fcRateAt(FC_MAP[key], tc, seed) * dtH;
    vals.push(v);
    tot += v;
  }
  return { tot, vals };
}

function fcMetricSpark(span: number, N: number, _seed: number, fn: (tc: number, dtH: number) => number): number[] {
  const now = FC_ORIGIN;
  const dt = span / N;
  const dtH = dt / 3600e3;
  const a: number[] = [];
  for (let i = 0; i < N; i++) {
    const tc = now - span + dt * (i + 0.5);
    a.push(fn(tc, dtH));
  }
  return a;
}

/* ── formatting ─────────────────────────────────────────────────────────── */

const FC_M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fcPad = (n: number) => String(n).padStart(2, '0');
const fcNum = (n: number) => (n >= 1000 ? Math.round(n).toLocaleString() : String(Math.round(n)));
const fcR1 = (n: number) => Math.round(n * 10) / 10;
function fcXLabel(ts: number, range: FcRange): string {
  const d = new Date(ts);
  return range === '7d' || range === '30d' ? `${d.getMonth() + 1}/${d.getDate()}` : `${fcPad(d.getUTCHours())}:${fcPad(d.getUTCMinutes())}`;
}
function fcFullTime(ts: number): string {
  const d = new Date(ts);
  return `${FC_M[d.getUTCMonth()]} ${d.getUTCDate()} · ${fcPad(d.getUTCHours())}:${fcPad(d.getUTCMinutes())}`;
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
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const rng = mx - mn || 1;
  const pts: Pt[] = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 2 - ((v - mn) / rng) * (H - 6)]);
  const line = fcMono(pts);
  const gid = useMemo(() => 'fcsp' + (fcSpkSeq++).toString(36), []);
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

function FcChart({ state, seed }: { state: FcState; seed: number }) {
  const [hover, setHover] = useState<Hover>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  const series = FC_GROUPINGS[state.grouping].filter((s) => !state.hidden.has(s.key));
  const fullSpan = FC_RANGES[state.range];
  const fullT0 = FC_ORIGIN - fullSpan;
  const za = state.za;
  const zb = state.zb;
  const tStart = fullT0 + za * fullSpan;
  const tEnd = fullT0 + zb * fullSpan;
  const N = state.chart === 'bar' ? 40 : 64;
  const isShare = state.scale === 'share';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { cats, raw } = useMemo(() => fcSampleWin(series, tStart, tEnd, N, seed), [series.map((s) => s.key).join(), state.range, state.chart, za, zb, seed]);
  const colTot = cats.map((_, i) => series.reduce((a, _s, si) => a + raw[si][i], 0));

  const valAt = (si: number, i: number) => (isShare ? (colTot[i] ? (raw[si][i] / colTot[i]) * 100 : 0) : raw[si][i]);

  let yMax: number;
  if (isShare) yMax = 100;
  else if (state.chart === 'bar') yMax = Math.max(1, ...colTot);
  else yMax = Math.max(1, ...series.map((_s, si) => Math.max(...raw[si])));
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
  const xAt = (i: number) => padX + ((i + (state.chart === 'bar' ? 0.5 : 0)) / (state.chart === 'bar' ? N : N - 1)) * (100 - padX * 2);
  const yAt = (v: number) => 100 - (v / yMax) * 100;
  const barW = ((100 - padX * 2) / N) * 0.7;

  function onMove(e: React.MouseEvent) {
    const r = plotRef.current!.getBoundingClientRect();
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
        {cats.map((tc, i) => i % Math.ceil(N / 8) === 0 && (
          <span key={i} className="fc-xtick" style={{ left: xAt(i) + '%' }}>{fcXLabel(tc, state.range)}</span>
        ))}
      </div>
    </div>
  );
}

/* ── x-axis zoom brush ──────────────────────────────────────────────────── */

function FcZoom({
  za,
  zb,
  preview,
  range,
  onChange,
  onReset,
}: {
  za: number;
  zb: number;
  preview: number[];
  range: FcRange;
  onChange: (a: number, b: number) => void;
  onReset: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const startDrag = (mode: 'a' | 'b' | 'pan') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = ref.current!.getBoundingClientRect();
    const startX = e.clientX;
    const sa = za;
    const sb = zb;
    const onMoveEv = (ev: MouseEvent) => {
      const f = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const df = (ev.clientX - startX) / rect.width;
      if (mode === 'a') onChange(Math.min(f, sb - 0.05), sb);
      else if (mode === 'b') onChange(sa, Math.max(f, sa + 0.05));
      else {
        let na = sa + df;
        let nb = sb + df;
        if (na < 0) {
          nb -= na;
          na = 0;
        }
        if (nb > 1) {
          na -= nb - 1;
          nb = 1;
        }
        onChange(na, nb);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMoveEv);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMoveEv);
    window.addEventListener('mouseup', onUp);
  };
  const W = 100;
  const H = 100;
  const mx = Math.max(...preview, 1);
  const pts: Pt[] = preview.map((v, i) => [(i / (preview.length - 1)) * W, H - 2 - (v / mx) * (H - 10)]);
  const line = fcMono(pts);
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  const lab = (f: number) => {
    const d = new Date(FC_ORIGIN - FC_RANGES[range] * (1 - f));
    return fcXLabel(d.getTime(), range);
  };
  return (
    <div className="fc-zoomwrap">
      <div className="fc-zoom" ref={ref} onDoubleClick={onReset}>
        <svg className="fc-zoom-bg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={area} fill="var(--po-line-strong)" opacity="0.5" />
          <path d={line} fill="none" stroke="var(--po-fg-4)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="fc-zoom-mask" style={{ left: 0, width: za * 100 + '%' }} />
        <div className="fc-zoom-mask" style={{ right: 0, width: (1 - zb) * 100 + '%' }} />
        <div className="fc-zoom-sel" style={{ left: za * 100 + '%', right: (1 - zb) * 100 + '%' }} onMouseDown={startDrag('pan')}>
          <span className="fc-zoom-h fc-zoom-hl" onMouseDown={startDrag('a')} />
          <span className="fc-zoom-h fc-zoom-hr" onMouseDown={startDrag('b')} />
        </div>
      </div>
      <div className="fc-zoom-foot">
        <span>
          {lab(za)} – {lab(zb)}
        </span>
        <span className="fc-zoom-hint">{za > 0.001 || zb < 0.999 ? 'drag edges to zoom · double-click to reset' : 'drag the edges to zoom the time axis'}</span>
      </div>
    </div>
  );
}

/* ── page body ──────────────────────────────────────────────────────────── */

function FailureCellsPage() {
  const [state, setState] = useState<FcState>({
    chart: 'bar',
    grouping: 'cells',
    scale: 'count',
    range: '24h',
    smooth: true,
    threshold: true,
    hidden: new Set<string>(),
    seed: 7,
    za: 0,
    zb: 1,
  });
  const set = (patch: Partial<FcState>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      if (patch.grouping || patch.chart) next.hidden = new Set<string>();
      if (patch.range !== undefined) {
        next.za = 0;
        next.zb = 1;
      }
      return next;
    });
  const setZoom = (a: number, b: number) => setState((s) => ({ ...s, za: a, zb: b }));
  const toggleHidden = (key: string) =>
    setState((s) => {
      const h = new Set(s.hidden);
      if (h.has(key)) h.delete(key);
      else h.add(key);
      return { ...s, hidden: h };
    });

  const span = FC_RANGES[state.range];
  const cur = fcWindowStats(FC_ORIGIN, span, state.seed);
  const hbad = cur.healthyPct < 90;

  const Seg = ({ group, opts }: { group: FcGroupKey; opts: [string, string, boolean?][] }) => (
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
  const Tog = ({ flag, label, ok }: { flag: FcFlagKey; label: string; ok: boolean }) => (
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
          <span className={'fc-hero-num' + (hbad ? ' is-bad' : '')}>{fcR1(cur.healthyPct)}%</span>
          <div className="fc-hero-lab">
            <span>healthy</span>
            <span className={'fc-tgt' + (hbad ? ' is-miss' : '')}>{hbad ? 'below 90% ✗' : 'target 90% ✓'}</span>
          </div>
        </div>
      </div>

      <div className="fc-controls">
        <div className="fc-cgrp">
          <span className="fc-kicker">Chart</span>
          <Seg group="chart" opts={[['bar', 'Bars'], ['line', 'Lines']]} />
        </div>
        <div className="fc-cgrp">
          <span className="fc-kicker">Group by</span>
          <Seg group="grouping" opts={[['cells', '6 cells'], ['completeness', 'Completeness']]} />
        </div>
        <div className="fc-cgrp">
          <span className="fc-kicker">Scale</span>
          <Seg group="scale" opts={[['count', 'Count'], ['share', 'Share %']]} />
        </div>
        <div className="fc-cgrp">
          <span className="fc-kicker">Window</span>
          <Seg group="range" opts={[['1h', '1h'], ['6h', '6h'], ['24h', '24h'], ['7d', '7d'], ['30d', '30d']]} />
        </div>
        <div className="fc-cgrp">
          <span className="fc-kicker">Options</span>
          <div className="fc-toggles">
            <Tog flag="smooth" label="Smooth" ok={state.chart === 'line'} />
            <Tog flag="threshold" label="SLO line" ok={state.scale === 'share'} />
            <button className="fc-ghost" onClick={() => set({ seed: (state.seed * 1103515245 + 12345) >>> 0 })}>⟳ Reseed</button>
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
              let cnt = 0;
              s.members.forEach((m) => (cnt += fcCellWindow(m, span, state.seed).tot));
              const off = state.hidden.has(s.key);
              return (
                <button key={s.key} className={'fc-lg' + (off ? ' is-off' : '')} onClick={() => toggleHidden(s.key)}>
                  <span className="fc-lg-d" style={{ background: s.color }} />
                  {s.label}
                  <span className="fc-lg-c">{fcNum(cnt)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <FcChart state={state} seed={state.seed} />
        <FcZoom
          za={state.za}
          zb={state.zb}
          range={state.range}
          preview={fcMetricSpark(span, 60, state.seed, (tc, dtH) => {
            let t = 0;
            for (const c of FC_CELLS) t += fcRateAt(c, tc, state.seed) * dtH;
            return t;
          })}
          onChange={setZoom}
          onReset={() => setZoom(0, 1)}
        />
      </div>

      <div className="fc-breakout">
        <div className="fc-breakhead">
          <h2>
            Break out cells <span>· trailing {state.range}</span>
          </h2>
        </div>
        <div className="fc-smgrid">
          {FC_CELLS.map((c) => {
            const cw = fcCellWindow(c.key, span, state.seed);
            const N = 48;
            const dt = span / N;
            const dtH = dt / 3600e3;
            let prevTot = 0;
            for (let i = 0; i < N; i++) {
              const tc = FC_ORIGIN - span - span + dt * (i + 0.5);
              prevTot += fcRateAt(c, tc, state.seed) * dtH;
            }
            const d = prevTot ? ((cw.tot - prevTot) / prevTot) * 100 : 0;
            const good = c.healthy ? d > 0 : d < 0;
            const dcls = Math.abs(d) < 0.5 ? 'fc-neu' : good ? 'fc-up' : 'fc-down';
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
                  <span className="fc-sm-c" style={{ color: c.color }}>{fcNum(cw.tot)}</span>
                  <span className="fc-sm-sh">{fcR1((cw.tot / (cur.total || 1)) * 100)}%</span>
                  <span className={'fc-sm-dl ' + dcls}>{d >= 0 ? '▲' : '▼'} {fcR1(Math.abs(d))}%</span>
                </div>
                <FcSpark vals={cw.vals} color={c.color} />
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
      <FailureCellsPage />
    </ProjectShell>
  );
}
