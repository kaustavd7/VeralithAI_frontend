import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import { HealthDonut } from '../components/charts/HealthDonut';
import { ProfileBadges } from '../components/charts/ProfileBadges';
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
  const n = vals.length;
  const inner = h - pad * 2;
  const pts = vals.map((v, i) => [(i / (n - 1)) * w, pad + (1 - v) * inner] as [number, number]);
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
function Spark({ seed = 7, w = 132, h = 38, n = 13, trend = 0.012, color = 'var(--accent)', dot = true }: {
  seed?: number; w?: number; h?: number; n?: number; trend?: number; color?: string; dot?: boolean;
}) {
  const vals = wfVals(seed, n, trend);
  const d = wfPath(vals, w, h, 3);
  const lastY = 3 + (1 - vals[n - 1]) * (h - 6);
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
function BigChart({ h = 170, seed = 3, n = 42, trend = 0.004, color = 'var(--accent)', cap = '// hourly · 00:00 → now', l = '12:00 AM', r = 'now', bare = false, fmt, xfmt, yticks }: {
  h?: number; seed?: number; n?: number; trend?: number; color?: string; cap?: string; l?: string; r?: string; bare?: boolean;
  fmt?: (v: number) => string; xfmt?: (i: number) => string; yticks?: { v: number; label: string }[];
}) {
  const W = 720;
  const innerH = h - 26;
  const GUT = 34; // fixed-px Y-axis label gutter (kept out of the SVG so the line never reaches it)
  // morph the line: tween the points from the current shape to the new one on data change
  const target = useMemo(() => wfVals(seed, n, trend), [seed, n, trend]);
  const [vals, setVals] = useState(target);
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
  const xLabel = xfmt || ((i: number) => String(Math.round((i / (n - 1)) * 23)).padStart(2, '0') + ':00');

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHi(Math.round(frac * (n - 1)));
  }
  const px = hi == null ? 0 : (hi / (n - 1)) * W;
  // match wfPath's plotted y (pad + (1-v)*(h - 2*pad)) so the dot sits ON the line
  const py = hi == null ? 0 : 3 + (1 - vals[hi]) * (innerH - 6);
  const tipLeft = hi == null ? 0 : Math.max(7, Math.min(93, (hi / (n - 1)) * 100));
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
/* ── period toggle (Today / Yesterday / Last week) with per-period demo data ── */
type StatRow = { l: string; v: string; d: 'up' | 'down' | 'flat'; ds: string; warn?: boolean };
type PeriodId = 'today' | 'yesterday' | 'week';
const PERIOD_TABS: { id: PeriodId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last week' },
];
const WEEK_DAYS = ['May 26', 'May 27', 'May 28', 'May 29', 'May 30', 'May 31', 'Jun 1'];
type PeriodData = {
  healthy: number;
  deltaDir: 'up' | 'down' | 'flat';
  deltaText: string;
  chartSeed: number;
  chartTrend: number;
  chartCap: string;
  chartL: string;
  chartR: string;
  xfmt?: (i: number) => string;
  stats: StatRow[];
};
const PERIOD_DATA: Record<PeriodId, PeriodData> = {
  today: {
    healthy: 86.9, deltaDir: 'up', deltaText: '2.7pp vs 84.2% yesterday',
    chartSeed: 4, chartTrend: 0.003, chartCap: '// healthy rate · hourly', chartL: '12:00 AM', chartR: 'now',
    stats: [
      { l: 'New traces', v: '1,284', d: 'up', ds: '+16.5%' },
      { l: 'New failures', v: '3', d: 'down', ds: '+3 today', warn: true },
      { l: 'New heals', v: '7', d: 'up', ds: '+4 today' },
      { l: 'p95 latency', v: '1.8s', d: 'flat', ds: '±0.0s' },
    ],
  },
  yesterday: {
    healthy: 84.2, deltaDir: 'down', deltaText: '1.1pp vs 85.3% prior day',
    chartSeed: 11, chartTrend: -0.001, chartCap: '// healthy rate · hourly', chartL: '12:00 AM', chartR: '11:59 PM',
    stats: [
      { l: 'Traces', v: '1,102', d: 'down', ds: '-4.2%' },
      { l: 'Failures', v: '6', d: 'down', ds: '+3', warn: true },
      { l: 'Heals', v: '4', d: 'flat', ds: '±0' },
      { l: 'p95 latency', v: '2.1s', d: 'down', ds: '+0.3s' },
    ],
  },
  week: {
    healthy: 85.4, deltaDir: 'up', deltaText: '1.9pp vs 83.5% prior week',
    chartSeed: 23, chartTrend: 0.004, chartCap: '// healthy rate · daily', chartL: 'May 26', chartR: 'Jun 1',
    xfmt: (i) => WEEK_DAYS[Math.round((i / 41) * 6)],
    stats: [
      { l: 'Traces', v: '8,940', d: 'up', ds: '+12.1%' },
      { l: 'Failures', v: '38', d: 'down', ds: '+5 vs wk', warn: true },
      { l: 'Heals', v: '41', d: 'up', ds: '+15 vs wk' },
      { l: 'p95 latency', v: '1.9s', d: 'flat', ds: '-0.1s' },
    ],
  },
};
/* health bands: good ≥85%, warn 70–85%, bad <70%. Colours (incl. a
   light-mode-legible healthy green) live in CSS, keyed off the state class. */
function healthState(pct: number): 'good' | 'warn' | 'bad' {
  return pct >= 85 ? 'good' : pct >= 70 ? 'warn' : 'bad';
}
function healthLabel(pct: number): string {
  return pct >= 85 ? 'Healthy' : pct >= 70 ? 'Degraded' : 'Critical';
}
function HealthBadge({ pct }: { pct: number }) {
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

/* Fires once, when the element first scrolls into view. */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
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
    return () => obs.disconnect();
  }, [inView, threshold]);
  return [ref, inView] as const;
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

/* RAG health — composite index + 3 metric rows with microtrend sparklines */
const RH_METRICS = [
  { k: 'suff', label: 'Sufficiency', v: 0.81, prev: 0.78, target: 0.85, seed: 7, trend: 0.004 },
  { k: 'faith', label: 'Faithfulness', v: 0.88, prev: 0.87, target: 0.85, seed: 12, trend: 0.001 },
  { k: 'comp', label: 'Completeness', v: 0.72, prev: 0.75, target: 0.85, seed: 19, trend: -0.004 },
];
const RH_COMPOSITE = RH_METRICS.reduce((a, m) => a + m.v, 0) / RH_METRICS.length;
const rhColor = (m: { v: number; target: number }) => (m.v >= m.target ? 'var(--po-live)' : m.v >= m.target - 0.12 ? 'var(--po-idle)' : 'var(--po-bad)');
const fmt2 = (v: number) => v.toFixed(2);

function MetricDelta({ v, prev }: { v: number; prev: number }) {
  const d = v - prev;
  const dir = d > 0.005 ? 'up' : d < -0.005 ? 'down' : 'flat';
  const sym = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  return <span className={'wf-delta wf-delta-' + dir}>{sym} {(d >= 0 ? '+' : '') + d.toFixed(2)}</span>;
}

function RagHealthCard({ play = true }: { play?: boolean }) {
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
          <div className="rh-ih-num"><ScrambleNumber value={fmt2(RH_COMPOSITE)} play={play} /></div>
          <div className="rh-ih-l">RAG health<br /><span className="rh-ih-sub po-mono">mean of 3 · last 7d</span></div>
        </div>
        <div className="rh-index-rows">
          {RH_METRICS.map((m) => (
            <div className="rh-irow" key={m.k}>
              <span className="rh-ir-dot" style={{ background: rhColor(m) }} />
              <span className="rh-ir-l">{m.label}</span>
              <span className="rh-ir-spark"><Spark seed={m.seed} w={72} h={24} n={24} trend={m.trend} color={rhColor(m)} dot={false} /></span>
              <span className="rh-ir-v"><ScrambleNumber value={fmt2(m.v)} play={play} /></span>
              <MetricDelta v={m.v} prev={m.prev} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Knowledge-gap topics — failing-query clusters */
const KG_TOPICS = [
  { name: 'Billing & refunds', q: 42, cell: 'cu', note: 'hallucinated', d: 6 },
  { name: 'SSO / SAML setup', q: 34, cell: 'ig', note: 'retrieval gap', d: 3 },
  { name: 'API rate limits', q: 30, cell: 'iu', note: 'worst case', d: 5 },
  { name: 'Data residency', q: 24, cell: 'cu', note: 'hallucinated', d: 0 },
  { name: 'Webhook retries', q: 20, cell: 'ig', note: 'retrieval gap', d: -2 },
  { name: 'Export formats', q: 18, cell: 'eg', note: 'padded', d: 1 },
];
const KG_TOTAL = KG_TOPICS.reduce((a, t) => a + t.q, 0);
const cellColor = (k: string) => `var(--cell-${k})`;

function KnowledgeGapCell({ play = true, onTopic, onExplore }: { play?: boolean; onTopic: (cell: string) => void; onExplore: () => void }) {
  const max = KG_TOPICS[0].q;
  return (
    <div className="ovc-body kg-body">
      <div className="ovc-subhead"><ScrambleNumber value={String(KG_TOTAL)} play={play} /> failing queries · {KG_TOPICS.length} topics · 7d</div>
      <div className="kg-list">
        {KG_TOPICS.map((t, i) => (
          <div
            className="kg-row"
            key={t.name}
            role="link"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={() => onTopic(t.cell)}
            onKeyDown={onActivateKey(() => onTopic(t.cell))}
            aria-label={`View ${t.name} traces`}
          >
            <div className="kg-top">
              <span className="kg-dot" style={{ background: cellColor(t.cell) }} />
              <span className="kg-name">{t.name}</span>
              <span className="kg-q"><ScrambleNumber value={String(t.q)} play={play} /></span>
              <span className={'kg-d ' + (t.d > 0 ? 'is-up' : t.d < 0 ? 'is-down' : 'is-flat')}>{t.d > 0 ? '+' + t.d : t.d < 0 ? t.d : '—'}</span>
            </div>
            <div className="kg-meta">
              <span className="kg-bar"><i style={{ width: (t.q / max) * 100 + '%', background: cellColor(t.cell), transitionDelay: i * 0.06 + 's' }} /></span>
              <span className="kg-cell" style={{ color: cellColor(t.cell) }}>{t.note}</span>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="ovc-link" style={LINK_BTN_RESET} onClick={onExplore}>Explore topic clusters →</button>
    </div>
  );
}

/* Potential improvement — now → projected, + heal contributors */
const PI_CURRENT = 0.869, PI_PROJECTED = 0.942, PI_PENDING = 18;
const PI_HEALS = [
  { name: 'Add billing-refund chunks', gain: 3.1, traces: 42 },
  { name: 'Fix SSO doc retrieval', gain: 2.4, traces: 34 },
  { name: 'Tighten rate-limit prompt', gain: 1.8, traces: 30 },
];
function PotentialImprovementCell({ play = true, onHeals }: { play?: boolean; onHeals: () => void }) {
  const delta = ((PI_PROJECTED - PI_CURRENT) * 100).toFixed(1);
  return (
    <div className="ovc-body pi-body">
      <div className="pi-hero">
        <div className="pi-from"><span className="pi-from-n"><ScrambleNumber value={(PI_CURRENT * 100).toFixed(1) + '%'} play={play} /></span><span className="pi-lab">now</span></div>
        <span className="pi-arrow">→</span>
        <div className="pi-to"><span className="pi-to-n"><ScrambleNumber value={(PI_PROJECTED * 100).toFixed(1) + '%'} play={play} /></span><span className="pi-lab">if all heals done</span></div>
        <span className="pi-gain">+<ScrambleNumber value={delta} play={play} /> pp</span>
      </div>
      <div className="pi-meter">
        <div className="pi-meter-now" style={{ width: PI_CURRENT * 100 + '%' }} />
        <div className="pi-meter-gain" style={{ left: PI_CURRENT * 100 + '%', width: (PI_PROJECTED - PI_CURRENT) * 100 + '%' }} />
      </div>
      <div className="ovc-subhead">{PI_PENDING} pending heals · top contributors</div>
      <div className="pi-rows">
        {PI_HEALS.map((h) => (
          <div
            className="pi-row"
            key={h.name}
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
      <button type="button" className="ovc-link" style={LINK_BTN_RESET} onClick={onHeals}>Review all {PI_PENDING} heals →</button>
    </div>
  );
}

/* Ver-advice — prescriptive recommendation */
const VA_ACTIONS = [
  { t: 'Close the billing-refund gap', d: 'Largest single lift — 42 failing queries, +3.1pp projected.', tag: 'high' },
  { t: 'Audit completeness on long queries', d: 'Incomplete answers skew toward multi-part questions.', tag: 'med' },
  { t: 'Watch rate-limit hallucinations', d: 'cu in this topic rose +5 today — worth a judge re-check.', tag: 'watch' },
];
function VerAdviceCell() {
  return (
    <div className="ovc-body va-body">
      <p className="va-headline">Spend this week on retrieval coverage, not prompt tuning.</p>
      <p className="va-rationale">Faithfulness is already healthy at 0.88 — the model grounds well when it has the context. Your losses are completeness and grounding gaps that trace back to thin retrieval on a handful of topics. Fixing what gets retrieved will move the healthy rate more than any prompt change.</p>
      <div className="va-actions-h">Recommended next, in priority order</div>
      <div className="va-actions">
        {VA_ACTIONS.map((a, i) => (
          <div className="va-action" key={i}>
            <span className="va-num po-mono">{i + 1}</span>
            <div className="va-action-body">
              <div className="va-action-t">{a.t}<span className={'va-pri va-pri-' + a.tag}>{a.tag}</span></div>
              <div className="va-action-d">{a.d}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="va-outcome"><span className="va-outcome-l">Expected outcome</span><span className="va-outcome-v">86.9% → ~92% within two weeks if the top two ship</span></div>
    </div>
  );
}

/* Latency over time — detailed time-axis chart (24h / 7d), p50 + p95 + SLA */
const LAT_24_P95 = [1.4, 1.3, 1.3, 1.2, 1.3, 1.4, 1.6, 1.9, 2.2, 2.4, 2.5, 2.6, 2.7, 3.0, 3.2, 3.1, 2.8, 2.5, 2.2, 2.0, 1.9, 1.7, 1.6, 1.5];
const LAT_24_P50 = [0.8, 0.8, 0.7, 0.7, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.2, 1.3, 1.3, 1.4, 1.5, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0, 1.0, 0.9, 0.9];
const LAT_7_P95 = [2.2, 2.4, 2.9, 3.1, 2.8, 1.7, 1.5];
const LAT_7_P50 = [1.1, 1.2, 1.4, 1.5, 1.3, 1.0, 0.9];
const LAT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LAT_SLA = 2.5;
const hourLabel = (h: number) => (h < 10 ? '0' + h : h) + ':00';
type LatCfg = { p95: number[]; p50: number[]; N: number; ticks: number[]; xlab: (i: number) => string; slowFrom: number; slowTo: number; peak: number; p95peak: string; p50peak: string; insight: ReactNode };
const LAT_CFG: Record<'24h' | '7d', LatCfg> = {
  '24h': {
    p95: LAT_24_P95, p50: LAT_24_P50, N: 24, ticks: [0, 4, 8, 12, 16, 20], xlab: hourLabel,
    slowFrom: 13, slowTo: 16, peak: 14, p95peak: '3.2s', p50peak: '1.5s',
    insight: (<>RAG slows through the afternoon — p95 climbs to <b>3.2s around 14:00</b> (~1.8× the overnight floor) and breaches the 2.5s SLA from <b>13:00–16:00</b>. Mornings and nights stay comfortably fast.</>),
  },
  '7d': {
    p95: LAT_7_P95, p50: LAT_7_P50, N: 7, ticks: [0, 1, 2, 3, 4, 5, 6], xlab: (i) => LAT_DAYS[i],
    slowFrom: 2, slowTo: 4, peak: 3, p95peak: '3.1s', p50peak: '1.5s',
    insight: (<>Midweek is slowest — p95 peaks <b>Thursday at 3.1s</b> and breaches the 2.5s SLA <b>Wed–Fri</b>. Weekends run comfortably fast.</>),
  },
};
function LatencyDetailCell() {
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [hi, setHi] = useState<number | null>(null);
  const cfg = LAT_CFG[range];
  const N = cfg.N;
  const W = 760, H = 232, pl = 38, pr = 16, pt = 16, pb = 30;
  const iw = W - pl - pr, ih = H - pt - pb, ymax = 3.6;
  const x = (h: number) => pl + (h / (N - 1)) * iw;
  const y = (v: number) => pt + (1 - v / ymax) * ih;
  const line = (arr: number[]) => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = (arr: number[]) => line(arr) + ' L' + x(N - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
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
        <span className="lat-key"><i style={{ background: 'var(--po-idle)' }} />p95<b>{cfg.p95peak}</b><small>peak</small></span>
        <span className="lat-key"><i style={{ background: 'var(--po-fg-3)' }} />p50<b>{cfg.p50peak}</b><small>peak</small></span>
        <span className="lat-key lat-key-sla"><i className="lat-dash" />SLA 2.5s</span>
        <span className="lat-toggle">
          {(['24h', '7d'] as const).map((r) => (
            <button key={r} type="button" className={range === r ? 'is-on' : ''} onClick={() => setRange(r)}>{r}</button>
          ))}
        </span>
      </div>
      <div className="lat-plot" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        <svg className="lat-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
          {[1, 2, 3].map((g) => (
            <g key={g}>
              <line x1={pl} y1={y(g)} x2={W - pr} y2={y(g)} stroke="var(--po-line)" strokeWidth="1" />
              <text x={pl - 7} y={y(g) + 3} textAnchor="end" className="lat-ylab">{g}s</text>
            </g>
          ))}
          <rect x={x(cfg.slowFrom)} y={pt} width={x(cfg.slowTo) - x(cfg.slowFrom)} height={ih} fill="color-mix(in oklab, var(--po-idle) 14%, transparent)" />
          <text x={(x(cfg.slowFrom) + x(cfg.slowTo)) / 2} y={pt + 13} textAnchor="middle" className="lat-windowlab">peak load</text>
          <line x1={pl} y1={y(LAT_SLA)} x2={W - pr} y2={y(LAT_SLA)} stroke="var(--po-bad)" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.7" />
          <path d={area(cfg.p95)} fill="color-mix(in oklab, var(--po-idle) 16%, transparent)" />
          <path d={line(cfg.p95)} fill="none" stroke="var(--po-idle)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={line(cfg.p50)} fill="none" stroke="var(--po-fg-3)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          {hi == null && <circle cx={x(cfg.peak)} cy={y(cfg.p95[cfg.peak])} r="3.5" fill="var(--po-idle)" stroke="var(--po-panel)" strokeWidth="2" />}
          {hi != null && (
            <g>
              <line x1={x(hi)} x2={x(hi)} y1={pt} y2={pt + ih} stroke="var(--po-line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle cx={x(hi)} cy={y(cfg.p95[hi])} r="3.4" fill="var(--po-idle)" stroke="var(--po-panel)" strokeWidth="2" />
              <circle cx={x(hi)} cy={y(cfg.p50[hi])} r="3.4" fill="var(--po-fg-3)" stroke="var(--po-panel)" strokeWidth="2" />
            </g>
          )}
          {cfg.ticks.map((h) => (
            <text key={h} x={x(h)} y={H - 9} textAnchor="middle" className="lat-xlab">{cfg.xlab(h)}</text>
          ))}
        </svg>
        {hi != null && (
          <div className="wf-chart-tip lat-tip" style={{ left: tipPct + '%', top: y(cfg.p95[hi]) }}>
            <span className="wf-chart-tip-x po-mono">{cfg.xlab(hi)}</span>
            <span className="lat-tip-row"><i style={{ background: 'var(--po-idle)' }} />p95 <b>{cfg.p95[hi].toFixed(1)}s</b></span>
            <span className="lat-tip-row"><i style={{ background: 'var(--po-fg-3)' }} />p50 <b>{cfg.p50[hi].toFixed(1)}s</b></span>
          </div>
        )}
      </div>
      <div className="lat-insight">{cfg.insight}</div>
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
  const pd = PERIOD_DATA[period];
  const asOfDate = period === 'today' ? asOf : period === 'yesterday' ? 'Jun 1' : 'May 26 – Jun 1';
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

        <div className="wf-b-grid">
          <div className="wf-b-pulse wf-card">
            <div className="wf-mlabel">Healthy rate · <HealthBadge pct={pd.healthy} /></div>
            <div className="wf-num" style={{ fontSize: 52 }}><ScrambleNumber value={`${pd.healthy.toFixed(1)}%`} /></div>
            <div className="wf-metric-sub"><Delta dir={pd.deltaDir}>{pd.deltaText}</Delta></div>
            <BigChart h={150} seed={pd.chartSeed} cap={pd.chartCap} trend={pd.chartTrend} l={pd.chartL} r={pd.chartR} xfmt={pd.xfmt} fmt={(v) => (80 + v * 14).toFixed(1) + '%'} yticks={[90, 86, 82].map((p) => ({ v: (p - 80) / 14, label: p + '%' }))} />
          </div>

          <div className="wf-b-right">
            <div className="wf-asof">
              <span className="wf-asof-pre">as of</span>
              <span className="wf-asof-main"><b>{asOfDate}</b> · {asOfSub}</span>
            </div>
            <div className="wf-b-stats">
              {pd.stats.map((s, i) => (
                <div
                  className="wf-b-stat wf-card"
                  key={i}
                  role="link"
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(statHref(i))}
                  onKeyDown={onActivateKey(() => navigate(statHref(i)))}
                  aria-label={`View ${s.l}`}
                >
                  <span className="wf-mlabel">{s.l}</span>
                  <span className={'wf-num' + (s.warn ? ' wf-warn' : '')}><ScrambleNumber value={s.v} /></span>
                  <Delta dir={s.d}>{s.ds}</Delta>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="wf-profile-sec">
        <div className="wf-card wf-profile">
          <div className="ovc-head">
            <div className="ovc-title">Trace health profile</div>
            <span className="ovc-tag po-mono">failure-cell mix · achievements</span>
          </div>
          <div className="wf-profile-body">
            <div className="wf-profile-donut"><HealthDonut onCellClick={(cell) => navigate(tracesPath(slug, cell))} /></div>
            <div className="wf-profile-side"><ProfileBadges /></div>
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
            <div className="ovc-card ovc-flush"><RagHealthCard play={ovInView} /></div>
            <OvCell title="Latency over time" sub="p50 · p95 · 24h / 7d"><LatencyDetailCell /></OvCell>
            <OvCell title="Ver-advice" sub="what we'd do next"><VerAdviceCell /></OvCell>
          </div>
          <div className="ovc-col ovc-col-r">
            <OvCell title="Knowledge-gap topics" sub="failing-query clusters"><KnowledgeGapCell play={ovInView} onTopic={(cell) => navigate(tracesPath(slug, cell))} onExplore={() => navigate(cellsPath(slug))} /></OvCell>
            <OvCell title="Potential improvement" sub="if all heals done" grow><PotentialImprovementCell play={ovInView} onHeals={() => navigate(healsPath(slug))} /></OvCell>
          </div>
        </div>
      </section>
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
