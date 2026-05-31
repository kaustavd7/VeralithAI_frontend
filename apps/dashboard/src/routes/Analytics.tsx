import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import { useStats, useTraces } from '../hooks/useOverviewData';
import type {
  FailureCell,
  StatsTimeseriesPoint,
} from '../api/types';

/* Time-window vocabulary. Each panel may resolve to a different window
   (page default OR per-panel override). See DEV2_HANDOFF.md §1. */
type TimeWindow = '1h' | '24h' | '7d' | '30d';

function sinceForWindow(win: TimeWindow): string {
  const ms =
    win === '1h' ? 3_600_000 :
    win === '24h' ? 86_400_000 :
    win === '7d' ? 7 * 86_400_000 :
    30 * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}
function bucketForWindow(win: TimeWindow): 'hour' | 'day' {
  return win === '7d' || win === '30d' ? 'day' : 'hour';
}
function subtitleForWindow(win: TimeWindow): string {
  return win === '1h' ? 'hourly · last 1h' :
         win === '24h' ? 'hourly · last 24h' :
         win === '7d' ? 'daily · last 7d' :
         'daily · last 30d';
}

/* ─────────────────────────────────────────────────────────────
   Catmull-Rom smoothing + Gaussian kernel — ported from
   planning/Context/VeralithAI/analytics.jsx verbatim.
   ─────────────────────────────────────────────────────────── */

function anSmooth(pts: [number, number][], t = 0.5): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * t;
    const cp1y = p1[1] + (p2[1] - p0[1]) * t;
    const cp2x = p2[0] - (p3[0] - p1[0]) * t;
    const cp2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function gSmooth(vals: number[], sigma = 1.4): number[] {
  if (vals.length === 0) return vals;
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const k: number[] = [];
  for (let i = -r; i <= r; i++) k.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const sum = k.reduce((s, w) => s + w, 0);
  return vals.map((_, idx) => {
    let acc = 0;
    for (let j = -r; j <= r; j++) {
      const m = Math.max(0, Math.min(vals.length - 1, idx + j));
      acc += vals[m] * k[j + r];
    }
    return acc / sum;
  });
}

/* ─────────────────────────────────────────────────────────────
   Panel chrome
   ─────────────────────────────────────────────────────────── */

function GripDots() {
  return (
    <div className="an-grip">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="an-grip-dot" />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Panel actions (⋯ menu) — time-window override + placeholders
   for Duplicate / Export / Remove (UI-only until DEV2_HANDOFF §1
   layout-persistence and CSV-per-panel work lands).
   ─────────────────────────────────────────────────────────── */

const WIN_OPTIONS: TimeWindow[] = ['1h', '24h', '7d', '30d'];

function PanelActions({
  windowed,
  win,
  onWin,
  onClear,
}: {
  windowed: boolean;
  win: TimeWindow;
  onWin: (w: TimeWindow) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="an-actions">
      <div className="an-more-wrap" ref={ref}>
        <button
          type="button"
          className={'an-act' + (open ? ' is-active' : '')}
          title="Panel options"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="2" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="10" cy="6" r="1" fill="currentColor" />
          </svg>
        </button>
        {open && (
          <div className="an-more-menu" onMouseDown={(e) => e.stopPropagation()}>
            {windowed && (
              <>
                <div className="an-more-hd">Time window</div>
                <div className="an-more-wins">
                  {WIN_OPTIONS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      className={'an-more-win' + (w === win ? ' is-active' : '')}
                      onClick={() => { onWin(w); setOpen(false); }}
                    >{w}</button>
                  ))}
                </div>
                <div className="an-more-note">Overrides the page window for this panel only.</div>
                <button
                  type="button"
                  className="an-more-item"
                  onClick={() => { onClear(); setOpen(false); }}
                >Follow page window</button>
                <div className="an-more-div" />
              </>
            )}
            <button type="button" className="an-more-item" disabled>Duplicate panel</button>
            <button type="button" className="an-more-item" disabled>Export data · CSV</button>
            <button type="button" className="an-more-item an-more-danger" disabled>Remove panel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AnPanel({
  title,
  subtitle,
  kpi,
  kpiDelta,
  kpiDir = 'flat',
  span,
  windowed = false,
  win = '24h',
  override = false,
  onWin,
  onClearWin,
  children,
}: {
  title: string;
  subtitle?: string;
  kpi?: string;
  kpiDelta?: string;
  kpiDir?: 'up' | 'down' | 'flat';
  span: number;
  /** Panel responds to per-panel window override. */
  windowed?: boolean;
  /** Current resolved window (panel override or page default). */
  win?: TimeWindow;
  /** Whether `win` is an override (true) or inherited from page (false). */
  override?: boolean;
  onWin?: (w: TimeWindow) => void;
  onClearWin?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="an-panel" style={{ gridColumn: `span ${span}` }}>
      <div className="an-panel-head">
        <GripDots />
        <div className="an-panel-tg">
          <span className="an-panel-title">
            {title}
            {windowed && override && (
              <span className="an-win-pill" title="Panel time-window override">{win}</span>
            )}
          </span>
          {subtitle && <span className="an-panel-sub">{subtitle}</span>}
        </div>
        {kpi !== undefined && (
          <div className="an-panel-kpi">
            <span className="an-kpi-val po-mono">{kpi}</span>
            {kpiDelta && <span className={`an-kpi-d po-mono an-d-${kpiDir}`}>{kpiDelta}</span>}
          </div>
        )}
        {windowed && (
          <PanelActions
            windowed={windowed}
            win={win}
            onWin={(w) => onWin?.(w)}
            onClear={() => onClearWin?.()}
          />
        )}
      </div>
      <div className="an-panel-body">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Trace Volume chart (OK + Failed, hover crosshair tooltip).
   Data source: stats.timeseries[].count / ok / failed.
   ─────────────────────────────────────────────────────────── */

function TraceVolumePanel({ slug, pageWindow }: { slug: string; pageWindow: TimeWindow }) {
  const { win, override, setOverride, clearOverride } = usePanelWindow(pageWindow);
  const statsQuery = useStats(slug, useMemo(
    () => ({ since: sinceForWindow(win), bucket: bucketForWindow(win) }),
    [win],
  ));
  const stats = statsQuery.data;
  const [hi, setHi] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  if (!stats) {
    return (
      <AnPanel title="Trace volume" subtitle={subtitleForWindow(win)} span={12}
        windowed win={win} override={override} onWin={setOverride} onClearWin={clearOverride}>
        <div className="po-page-loading" style={{ padding: '20px 0' }}>Loading…</div>
      </AnPanel>
    );
  }

  const series = stats.timeseries;
  const okSeries = series.map((b) => b.ok);
  const badSeries = series.map((b) => b.failed);
  const n = series.length;
  const totalOk = okSeries.reduce((s, v) => s + v, 0);
  const totalBad = badSeries.reduce((s, v) => s + v, 0);
  const total = totalOk + totalBad;
  const badPct = total > 0 ? ((totalBad / total) * 100).toFixed(1) : '0.0';

  const W = 800;
  const H = 190;
  const pt = 10;
  const pb = 10;

  const ymax = Math.max(1, ...okSeries, ...badSeries);
  const yTickStep = roundNice(ymax / 3);
  const yTicks = [0, yTickStep, yTickStep * 2, yTickStep * 3];
  const yMaxTick = yTicks[yTicks.length - 1] || 1;

  const xAt = (i: number) => (n > 1 ? (W / (n - 1)) * i : W / 2);
  const yAt = (v: number) => H - pb - (v / yMaxTick) * (H - pb - pt);
  const yPct = (v: number) => ((H - pb - (v / yMaxTick) * (H - pb - pt)) / H) * 100;

  const okSm = gSmooth(okSeries, 1.4);
  const badSm = gSmooth(badSeries, 1.4);
  const okPts: [number, number][] = okSm.map((v, i) => [xAt(i), yAt(v)]);
  const badPts: [number, number][] = badSm.map((v, i) => [xAt(i), yAt(v)]);
  const okLine = anSmooth(okPts);
  const badLine = anSmooth(badPts);
  const base = yAt(0);
  const okArea = okLine + ` L ${xAt(n - 1)} ${base} L ${xAt(0)} ${base} Z`;
  const badArea = badLine + ` L ${xAt(n - 1)} ${base} L ${xAt(0)} ${base} Z`;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!chartRef.current || n < 2) return;
    const rect = chartRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(n - 1, Math.round((relX / rect.width) * (n - 1))));
    setHi(idx);
  }
  function handleLeave() {
    setHi(null);
  }

  const overlay =
    hi != null
      ? {
          xPct: n > 1 ? (hi / (n - 1)) * 100 : 50,
          flip: (hi / Math.max(1, n - 1)) * 100 > 58,
          okPct: (yAt(okSm[hi]) / H) * 100,
          badPct: (yAt(badSm[hi]) / H) * 100,
          ok: okSeries[hi],
          bad: badSeries[hi],
          label: shortBucketLabel(series[hi]),
        }
      : null;

  const xTickIdx = pickXTicks(n);
  const deltaPct = stats.deltas.total_traces_pct_24h;
  const deltaDir = deltaPct >= 0 ? 'up' : 'down';

  return (
    <AnPanel title="Trace volume" subtitle={subtitleForWindow(win)} span={12}
      windowed win={win} override={override} onWin={setOverride} onClearWin={clearOverride}>
      <div style={{ position: 'relative' }}>
        <div className="an-tv-stats">
          <div className="an-tv-legend">
            <span className="an-tv-leg">
              <span className="an-tv-dot" style={{ background: 'var(--po-live)' }} />
              <span className="an-tv-lbl">COMPLETED</span>
              <b className="an-tv-n">{totalOk.toLocaleString()}</b>
            </span>
            <span className="an-tv-leg">
              <span className="an-tv-dot" style={{ background: 'var(--po-bad)' }} />
              <span className="an-tv-lbl">FAILED</span>
              <b className="an-tv-n">{totalBad.toLocaleString()}</b>
              {total > 0 && <span className="an-tv-pct">· {badPct}%</span>}
            </span>
          </div>
          <div className="an-tv-kpi">
            <span className="an-tv-kpi-n">{total.toLocaleString()}</span>
            <span className={'an-tv-kpi-d' + (deltaDir === 'down' ? ' an-tv-kpi-d-warn' : '')}>
              {deltaDir === 'up' ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}% vs prev 24h
            </span>
          </div>
        </div>

        <div className="an-tv-chart-row">
          <div className="an-tv-yaxis">
            {yTicks.map((v) => (
              <span key={v} className="an-tv-ylabel" style={{ top: `${yPct(v)}%` }}>
                {v}
              </span>
            ))}
          </div>

          <div
            ref={chartRef}
            className="an-tv-chart-area"
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              style={{ display: 'block', cursor: 'crosshair' }}
            >
              {yTicks.map((v) => (
                <line
                  key={v}
                  x1={0}
                  x2={W}
                  y1={yAt(v)}
                  y2={yAt(v)}
                  stroke="var(--po-line)"
                  strokeWidth="0.6"
                  opacity="0.55"
                />
              ))}
              <path d={okArea} fill="rgba(93,209,161,0.13)" />
              <path d={badArea} fill="rgba(224,116,116,0.24)" />
              <path
                d={okLine}
                stroke="var(--po-live)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={badLine}
                stroke="var(--po-bad)"
                strokeWidth="1.7"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {overlay && (
              <>
                <div className="an-tv-crosshair" style={{ left: `${overlay.xPct}%` }} />
                <div
                  className="an-tv-dot-mark"
                  style={{
                    left: `${overlay.xPct}%`,
                    top: `${overlay.okPct}%`,
                    background: 'var(--po-live)',
                  }}
                />
                <div
                  className="an-tv-dot-mark"
                  style={{
                    left: `${overlay.xPct}%`,
                    top: `${overlay.badPct}%`,
                    background: 'var(--po-bad)',
                  }}
                />
                <div
                  className={'an-tv-tip' + (overlay.flip ? ' is-left' : '')}
                  style={{ left: `${overlay.xPct}%` }}
                >
                  <div className="an-tv-tip-hour">{overlay.label}</div>
                  <div className="an-tv-tip-row">
                    <span
                      className="an-tv-tip-dot"
                      style={{ background: 'var(--po-live)' }}
                    />
                    <span className="an-tv-tip-lbl">completed</span>
                    <span className="an-tv-tip-val">{overlay.ok}</span>
                  </div>
                  <div className="an-tv-tip-row">
                    <span
                      className="an-tv-tip-dot"
                      style={{ background: 'var(--po-bad)' }}
                    />
                    <span className="an-tv-tip-lbl">failed</span>
                    <span className="an-tv-tip-val">{overlay.bad}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="an-tv-xaxis">
          {xTickIdx.map((i) => (
            <span
              key={i}
              className="an-tv-xlabel"
              style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 50}%` }}
            >
              {shortBucketLabel(series[i])}
            </span>
          ))}
        </div>
      </div>
    </AnPanel>
  );
}

function roundNice(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return nice * pow;
}

function pickXTicks(n: number): number[] {
  if (n <= 1) return [0];
  if (n <= 5) return Array.from({ length: n }, (_, i) => i);
  const step = Math.max(1, Math.round((n - 1) / 4));
  const out: number[] = [];
  for (let i = 0; i < n; i += step) out.push(i);
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return out;
}

function shortBucketLabel(p: StatsTimeseriesPoint | undefined): string {
  if (!p) return '';
  const t = Date.parse(p.bucket);
  if (Number.isNaN(t)) return p.bucket;
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/* ─────────────────────────────────────────────────────────────
   Failure-cell bubble pack — derived from stats.by_cell.
   Greedy circle packing (porting `packCellBubbles` from
   analytics.jsx).
   ─────────────────────────────────────────────────────────── */

const CELL_BUBBLES: { id: FailureCell; label: string; rgb: string }[] = [
  { id: 'complete_grounded',     label: 'complete · grounded',     rgb: '120,196,150' },
  { id: 'incomplete_grounded',   label: 'incomplete · grounded',   rgb: '226,176,118' },
  { id: 'extra_grounded',        label: 'extra · grounded',        rgb: '220,206,128' },
  { id: 'complete_ungrounded',   label: 'complete · ungrounded',   rgb: '226,142,142' },
  { id: 'extra_ungrounded',      label: 'extra · ungrounded',      rgb: '220,135,135' },
  { id: 'incomplete_ungrounded', label: 'incomplete · ungrounded', rgb: '196,108,108' },
];

type PackedCell = {
  id: FailureCell;
  label: string;
  rgb: string;
  count: number;
  r: number;
  x: number;
  y: number;
};

function packCellBubbles(byCell: Record<FailureCell, number>) {
  const cells: PackedCell[] = CELL_BUBBLES.map((c) => ({
    ...c,
    count: byCell[c.id] ?? 0,
    r: 0,
    x: 0,
    y: 0,
  }));
  const grandTotal = cells.reduce((s, c) => s + c.count, 0);
  const maxC = Math.max(1, ...cells.map((c) => c.count));
  const rMin = 13;
  const rMax = 54;
  const logMax = Math.log(maxC + 1);
  cells.forEach((c) => {
    c.r = rMin + (Math.log(c.count + 1) / logMax) * (rMax - rMin);
  });

  const jit = (seed: number) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };

  const order = [...cells].sort((a, b) => b.r - a.r);
  const placed: PackedCell[] = [];
  const gap = 1.5;
  order.forEach((c, i) => {
    if (i === 0) {
      c.x = 0;
      c.y = 0;
      placed.push(c);
      return;
    }
    let cx = 0;
    let cy = 0;
    placed.forEach((p) => {
      cx += p.x;
      cy += p.y;
    });
    cx /= placed.length;
    cy /= placed.length;
    const startA = jit(i * 7 + 3) * Math.PI * 2;
    let best: { x: number; y: number } | null = null;
    for (let d = 0; d < 500 && !best; d += 1.5) {
      for (let s = 0; s < 28; s++) {
        const a = startA + (s / 28) * Math.PI * 2;
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d;
        let ok = true;
        for (const p of placed) {
          if (Math.hypot(x - p.x, y - p.y) < p.r + c.r + gap) {
            ok = false;
            break;
          }
        }
        if (ok) {
          best = { x, y };
          break;
        }
      }
    }
    c.x = best ? best.x : cx;
    c.y = best ? best.y : cy;
    placed.push(c);
  });

  const drift = 8;
  const captionH = 22;
  const padX = drift + 10;
  const rawMinX = Math.min(...cells.map((c) => c.x - c.r));
  const rawMaxX = Math.max(...cells.map((c) => c.x + c.r));
  const rawMinY = Math.min(...cells.map((c) => c.y - c.r));
  const rawMaxY = Math.max(...cells.map((c) => c.y + c.r));
  const ox = -rawMinX + padX;
  const oy = -rawMinY + drift;
  cells.forEach((c) => {
    c.x += ox;
    c.y += oy;
  });
  const vw = rawMaxX - rawMinX + padX * 2;
  const vh = rawMaxY - rawMinY + drift * 2 + captionH;
  return { cells, grandTotal, vw, vh };
}

function CellBubblePanel({ slug, pageWindow }: { slug: string; pageWindow: TimeWindow }) {
  const { win, override, setOverride, clearOverride } = usePanelWindow(pageWindow);
  const statsQuery = useStats(slug, useMemo(
    () => ({ since: sinceForWindow(win), bucket: bucketForWindow(win) }),
    [win],
  ));
  const byCell = statsQuery.data?.by_cell;
  const { cells, grandTotal, vw, vh } = useMemo(
    () => packCellBubbles(byCell ?? {
      complete_grounded: 0, complete_ungrounded: 0,
      incomplete_grounded: 0, incomplete_ungrounded: 0,
      extra_grounded: 0, extra_ungrounded: 0,
    }),
    [byCell],
  );
  const [hover, setHover] = useState<number | null>(null);
  const hc = hover != null ? cells[hover] : null;
  const healthyPct = grandTotal > 0
    ? Math.round(((byCell?.complete_grounded ?? 0) / grandTotal) * 100)
    : 0;

  return (
    <AnPanel
      title="Failure-cell distribution"
      subtitle={`bubble · area ∝ trace count · ${subtitleForWindow(win)}`}
      kpi={grandTotal.toLocaleString()}
      kpiDelta={`${healthyPct}% healthy`}
      kpiDir="up"
      span={5}
      windowed
      win={win}
      override={override}
      onWin={setOverride}
      onClearWin={clearOverride}
    >
      <svg
        width="100%"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', height: vh, flexShrink: 0 }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <radialGradient id="anBubSpace" cx="50%" cy="44%" r="62%">
            <stop offset="0%" stopColor="rgba(111,214,196,0.06)" />
            <stop offset="100%" stopColor="rgba(111,214,196,0)" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={vw} height={vh} fill="url(#anBubSpace)" />

        {cells.map((c, i) => {
          const dim = hover != null && hover !== i;
          const share = grandTotal > 0 ? c.count / grandTotal : 0;
          const pct = (share * 100).toFixed(share < 0.01 ? 1 : 0);
          return (
            <g key={c.id} transform={`translate(${c.x} ${c.y})`}>
              <g
                style={{
                  opacity: dim ? 0.32 : 1,
                  transition: 'opacity .2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHover(i)}
              >
                {hover === i && (
                  <circle r={c.r + 7} fill={`rgba(${c.rgb},0.16)`} />
                )}
                <circle r={c.r} fill={`rgba(${c.rgb},${hover === i ? 0.78 : 0.5})`} />
                {c.r >= 22 ? (
                  <>
                    <text
                      y="-2"
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="14"
                      fontWeight="700"
                      fontFamily="var(--font-sans)"
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        pointerEvents: 'none',
                        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                      }}
                    >
                      {c.count.toLocaleString()}
                    </text>
                    <text
                      y="13"
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.72)"
                      fontSize="10"
                      fontWeight="500"
                      fontFamily="var(--font-mono)"
                      style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                    >
                      {pct}%
                    </text>
                  </>
                ) : c.r >= 15 ? (
                  <text
                    y="4"
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="12"
                    fontWeight="700"
                    fontFamily="var(--font-sans)"
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      pointerEvents: 'none',
                      textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                    }}
                  >
                    {c.count.toLocaleString()}
                  </text>
                ) : (
                  <text
                    x={c.r + 7}
                    y="4"
                    textAnchor="start"
                    fill="#fff"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="var(--font-sans)"
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      pointerEvents: 'none',
                      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }}
                  >
                    {c.count.toLocaleString()}
                  </text>
                )}
              </g>
            </g>
          );
        })}

        <text
          x={vw / 2}
          y={vh - 6}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="500"
          fontFamily="var(--font-sans)"
          style={{ transition: 'opacity .2s ease', opacity: hc ? 1 : 0.7 }}
          fill={hc ? `rgb(${hc.rgb})` : 'var(--po-fg-3)'}
        >
          {hc
            ? `${hc.label} — ${hc.count.toLocaleString()} · ${(
                ((hc.count / Math.max(1, grandTotal)) * 100) || 0
              ).toFixed((hc.count / Math.max(1, grandTotal)) < 0.01 ? 1 : 0)}%`
            : 'hover a bubble · area ∝ trace count · last 24h'}
        </text>
      </svg>

      <div className="an-legend an-cell-legend">
        {CELL_BUBBLES.map((c) => (
          <span key={c.id} className="an-leg-item">
            <span className="an-leg-sw" style={{ background: `rgb(${c.rgb})` }} />
            {c.label}
          </span>
        ))}
      </div>
    </AnPanel>
  );
}

/* ─────────────────────────────────────────────────────────────
   Top failing queries — listTraces with client-side sufficiency
   sort (see BACKEND_GAPS.md Trace Explorer §8).
   ─────────────────────────────────────────────────────────── */

const CELL_COLOR: Record<FailureCell, string> = {
  complete_grounded: 'var(--cell-cg)',
  complete_ungrounded: 'var(--cell-cu)',
  incomplete_grounded: 'var(--cell-ig)',
  incomplete_ungrounded: 'var(--cell-iu)',
  extra_grounded: 'var(--cell-eg)',
  extra_ungrounded: 'var(--cell-eu)',
};
const CELL_LABEL: Record<FailureCell, string> = {
  complete_grounded: 'complete · grounded',
  complete_ungrounded: 'complete · ungrounded',
  incomplete_grounded: 'incomplete · grounded',
  incomplete_ungrounded: 'incomplete · ungrounded',
  extra_grounded: 'extra · grounded',
  extra_ungrounded: 'extra · ungrounded',
};

function TopFailingPanel({
  slug,
  pageWindow,
}: {
  slug: string;
  pageWindow: TimeWindow;
}) {
  const navigate = useNavigate();
  const { win, override, setOverride, clearOverride } = usePanelWindow(pageWindow);
  const tracesQuery = useTraces(
    slug,
    useMemo(
      () => ({ limit: 200, sort: 'newest' as const, since: sinceForWindow(win) }),
      [win],
    ),
  );
  const rows = useMemo(() => {
    const traces = tracesQuery.data?.traces ?? [];
    return [...traces]
      .filter((t) => t.sufficiency_fraction != null)
      .sort((a, b) => (a.sufficiency_fraction ?? 1) - (b.sufficiency_fraction ?? 1))
      .slice(0, 7);
  }, [tracesQuery.data]);

  return (
    <AnPanel
      title="Top failing queries"
      subtitle={`sufficiency ↑ · worst-first · ${subtitleForWindow(win)}`}
      span={12}
      windowed
      win={win}
      override={override}
      onWin={setOverride}
      onClearWin={clearOverride}
    >
      <div className="an-leaderboard">
        {rows.length === 0 && (
          <div style={{ color: 'var(--po-fg-3)', fontSize: 12, padding: '12px 0' }}>
            No evaluated traces in this window.
          </div>
        )}
        {rows.map((r, i) => {
          const s = r.sufficiency_fraction ?? 0;
          const fill =
            s < 0.3 ? 'var(--cell-iu)' : s < 0.6 ? 'var(--cell-ig)' : 'var(--cell-cg)';
          const cellColor = r.failure_cell ? CELL_COLOR[r.failure_cell] : 'var(--po-fg-4)';
          const cellLabel = r.failure_cell ? CELL_LABEL[r.failure_cell] : '—';
          return (
            <div
              key={r.id}
              className="an-lb-row"
              onClick={() => navigate(`/projects/${slug}/traces/${r.id}`)}
              role="link"
              tabIndex={0}
              title={r.query}
            >
              <span className="an-lb-rank po-mono">#{i + 1}</span>
              <span className="an-lb-q">{r.query}</span>
              <span
                className="an-lb-cell"
                style={{ ['--c' as keyof CSSProperties]: cellColor } as CSSProperties}
              >
                <span className="an-lb-dot" />
                {cellLabel}
              </span>
              <div className="an-lb-meter">
                <span className="po-mono an-lb-num">{s.toFixed(2)}</span>
                <div className="an-lb-track">
                  <div
                    className="an-lb-fill"
                    style={{ width: `${s * 100}%`, background: fill }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AnPanel>
  );
}

/* ─────────────────────────────────────────────────────────────
   Hallucination Trend — count of traces with faithfulness < 0.6
   over the active window, bucketed client-side (no dedicated API
   yet — see Analytics productionization doc §2 for the planned
   `/stats` field addition once volume outgrows JS bucketing).

   Headline KPI: rate as % of total volume in window.
   Chart: area + line, hover crosshair, mode toggle (line/bars).
   ─────────────────────────────────────────────────────────── */

function HallucinationTrendPanel({
  slug,
  pageWindow,
}: {
  slug: string;
  pageWindow: TimeWindow;
}) {
  const { win, override, setOverride, clearOverride } = usePanelWindow(pageWindow);
  const [mode, setMode] = useState<'line' | 'bars'>('line');
  const [hi, setHi] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // One traces fetch + one stats fetch per panel-window.
  const since = sinceForWindow(win);
  const tracesQuery = useTraces(
    slug,
    useMemo(
      () => ({ limit: 200, sort: 'newest' as const, since }),
      [since],
    ),
  );
  const statsQuery = useStats(
    slug,
    useMemo(
      () => ({ since, bucket: bucketForWindow(win) }),
      [since, win],
    ),
  );

  // Client-side bucketing — count traces with faithfulness_fraction < 0.6
  // per bucket of the corresponding stats series. Fine at alpha volumes;
  // once daily volume exceeds ~10k, ask Dev 1 to add a per-bucket
  // `faithfulness_lt_0_6` count to `/stats.timeseries[]`.
  const series = useMemo(() => {
    const buckets = statsQuery.data?.timeseries ?? [];
    if (buckets.length === 0) return { series: [] as number[], labels: [] as string[] };
    const bucketStartsMs = buckets.map((b) => Date.parse(b.bucket));
    const bucketSizeMs =
      bucketStartsMs.length > 1
        ? bucketStartsMs[1] - bucketStartsMs[0]
        : (win === '7d' || win === '30d' ? 86_400_000 : 3_600_000);
    const counts = new Array<number>(buckets.length).fill(0);
    for (const t of tracesQuery.data?.traces ?? []) {
      const f = t.faithfulness_fraction;
      if (f == null || f >= 0.6) continue;
      const ts = Date.parse(t.created_at);
      if (Number.isNaN(ts)) continue;
      const idx = Math.floor((ts - bucketStartsMs[0]) / bucketSizeMs);
      if (idx >= 0 && idx < counts.length) counts[idx] += 1;
    }
    return { series: counts, labels: buckets.map((b) => shortBucketLabel(b)) };
  }, [statsQuery.data, tracesQuery.data, win]);

  const n = series.series.length;
  const W = 800;
  const H = 190;
  const pt = 10;
  const pb = 10;
  const ymax = Math.max(1, ...series.series);
  const yStep = roundNice(ymax / 3);
  const yTicks = [0, yStep, yStep * 2, yStep * 3];
  const yMaxTick = yTicks[yTicks.length - 1] || 1;
  const xAt = (i: number) => (n > 1 ? (W / (n - 1)) * i : W / 2);
  const yAt = (v: number) => H - pb - (v / yMaxTick) * (H - pb - pt);
  const yPct = (v: number) => ((H - pb - (v / yMaxTick) * (H - pb - pt)) / H) * 100;
  const linePath = anSmooth(gSmooth(series.series, 1.2).map((v, i) => [xAt(i), yAt(v)]));
  const base = yAt(0);
  const areaPath = linePath + ` L ${xAt(Math.max(0, n - 1))} ${base} L ${xAt(0)} ${base} Z`;

  const totalHalluc = series.series.reduce((s, v) => s + v, 0);
  const totalTraces = useMemo(
    () => (statsQuery.data?.timeseries ?? []).reduce((s, b) => s + b.count, 0),
    [statsQuery.data],
  );
  const rate = totalTraces > 0 ? ((totalHalluc / totalTraces) * 100).toFixed(1) : '0.0';
  const peak = n > 0 ? Math.max(...series.series) : 0;
  const peakIdx = series.series.indexOf(peak);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!chartRef.current || n < 2) return;
    const rect = chartRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    setHi(Math.max(0, Math.min(n - 1, Math.round((relX / rect.width) * (n - 1)))));
  }
  function handleLeave() {
    setHi(null);
  }

  const overlay =
    hi != null && n > 0
      ? {
          xPct: n > 1 ? (hi / (n - 1)) * 100 : 50,
          flip: (hi / Math.max(1, n - 1)) * 100 > 58,
          topPct: yPct(series.series[hi]),
          label: series.labels[hi],
          count: series.series[hi],
        }
      : null;

  if (!statsQuery.data || !tracesQuery.data) {
    return (
      <AnPanel title="Hallucination trend" subtitle={subtitleForWindow(win)} span={7}
        windowed win={win} override={override} onWin={setOverride} onClearWin={clearOverride}>
        <div className="po-page-loading" style={{ padding: '20px 0' }}>Loading…</div>
      </AnPanel>
    );
  }

  return (
    <AnPanel
      title="Hallucination trend"
      subtitle={subtitleForWindow(win)}
      span={7}
      windowed
      win={win}
      override={override}
      onWin={setOverride}
      onClearWin={clearOverride}
    >
      <div style={{ position: 'relative' }}>
        <div className="an-tv-stats">
          <div className="an-tv-legend">
            <span className="an-tv-leg">
              <span className="an-tv-dot" style={{ background: 'var(--cell-cu)' }} />
              <span className="an-tv-lbl">FAITHFULNESS &lt; 0.6</span>
              <b className="an-tv-n">{totalHalluc.toLocaleString()}</b>
            </span>
            {peak > 0 && (
              <span className="an-tv-leg">
                <span className="an-tv-lbl-sub">
                  peak {peak} at {series.labels[peakIdx]}
                </span>
              </span>
            )}
          </div>
          <div className="an-tv-kpi">
            <span className="an-tv-kpi-n">{rate}%</span>
            <span className="an-tv-kpi-d an-tv-kpi-d-warn">of volume</span>
          </div>
        </div>

        <div className="an-seg-row">
          <div className="an-seg">
            <button
              type="button"
              className={'an-seg-opt' + (mode === 'line' ? ' is-active' : '')}
              onClick={() => setMode('line')}
            >Line</button>
            <button
              type="button"
              className={'an-seg-opt' + (mode === 'bars' ? ' is-active' : '')}
              onClick={() => setMode('bars')}
            >Bars</button>
          </div>
        </div>

        <div className="an-tv-chart-row">
          <div className="an-tv-yaxis">
            {yTicks.map((v) => (
              <span key={v} className="an-tv-ylabel" style={{ top: `${yPct(v)}%` }}>{v}</span>
            ))}
          </div>
          <div
            ref={chartRef}
            className="an-tv-chart-area"
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              style={{ display: 'block', cursor: 'crosshair' }}
            >
              <defs>
                <linearGradient id="anHalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(226,92,92,0.30)" />
                  <stop offset="100%" stopColor="rgba(226,92,92,0.02)" />
                </linearGradient>
              </defs>
              {yTicks.map((v) => (
                <line
                  key={v}
                  x1={0}
                  x2={W}
                  y1={yAt(v)}
                  y2={yAt(v)}
                  stroke="var(--po-line)"
                  strokeWidth="0.6"
                  opacity="0.55"
                />
              ))}
              {mode === 'line' ? (
                <>
                  <path d={areaPath} fill="url(#anHalFill)" />
                  <path
                    d={linePath}
                    stroke="var(--cell-cu)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : (
                series.series.map((v, i) => {
                  const bw = n > 1 ? (W / (n - 1)) * 0.6 : 12;
                  const x = Math.max(0, Math.min(W - bw, xAt(i) - bw / 2));
                  const y = yAt(v);
                  return (
                    <rect
                      key={i}
                      x={x}
                      width={bw}
                      y={y}
                      height={Math.max(0, base - y)}
                      fill="var(--cell-cu)"
                      opacity={hi === i ? 1 : 0.9}
                    />
                  );
                })
              )}
            </svg>
            {overlay && (
              <>
                <div className="an-tv-crosshair" style={{ left: `${overlay.xPct}%` }} />
                {mode === 'line' && (
                  <div
                    className="an-tv-dot-mark"
                    style={{
                      left: `${overlay.xPct}%`,
                      top: `${overlay.topPct}%`,
                      background: 'var(--cell-cu)',
                    }}
                  />
                )}
                <div
                  className={'an-tv-tip' + (overlay.flip ? ' is-left' : '')}
                  style={{ left: `${overlay.xPct}%` }}
                >
                  <div className="an-tv-tip-hour">{overlay.label}</div>
                  <div className="an-tv-tip-row">
                    <span className="an-tv-tip-dot" style={{ background: 'var(--cell-cu)' }} />
                    <span className="an-tv-tip-lbl">hallucinated</span>
                    <span className="an-tv-tip-val">{overlay.count}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="an-tv-xaxis">
          {pickXTicks(n).map((i) => (
            <span
              key={i}
              className="an-tv-xlabel"
              style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 50}%` }}
            >
              {series.labels[i]}
            </span>
          ))}
        </div>
      </div>
    </AnPanel>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page
   ─────────────────────────────────────────────────────────── */

export default function Analytics() {
  const { slug = '' } = useParams<{ slug: string }>();
  const projects = useProjects();
  const project = useMemo(
    () => projects.data?.projects.find((p) => p.slug === slug || p.id === slug),
    [projects.data, slug],
  );

  // Page default window. Each panel may override locally via its ⋯ menu.
  const [pageWindow, setPageWindow] = useState<TimeWindow>('24h');
  const projectName = project?.name ?? slug;

  return (
    <ProjectShell slug={slug} active="analytics" project={projectName}>
      <div className="an-page">
        <header className="an-header">
          <h1 className="an-title">Analytics</h1>
          <div className="an-tchips">
            {(['1h', '24h', '7d', '30d'] as TimeWindow[]).map((w) => (
              <button
                key={w}
                type="button"
                className={'an-tchip' + (w === pageWindow ? ' is-active' : '')}
                onClick={() => setPageWindow(w)}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="an-header-r">
            <button type="button" className="po-btn po-btn-ghost" disabled>
              Reset layout
            </button>
            <button type="button" className="an-add-btn" disabled title="Coming soon">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Add panel
            </button>
          </div>
        </header>

        <div className="an-grid">
          <TraceVolumePanel slug={slug} pageWindow={pageWindow} />
          <CellBubblePanel slug={slug} pageWindow={pageWindow} />
          <HallucinationTrendPanel slug={slug} pageWindow={pageWindow} />
          <TopFailingPanel slug={slug} pageWindow={pageWindow} />
        </div>

        <div className="an-status">
          <span className="an-s-dot" />
          <span className="an-s-text po-mono">
            <b>default</b> · 4 panels · grid · 12-col · snap to ¼
          </span>
          <span className="an-s-sep" />
          <span className="an-s-keys po-mono">4 panels live · latency/score-distributions/calibration-drift deferred (see BACKEND_GAPS.md §A)</span>
        </div>
      </div>
    </ProjectShell>
  );
}

/* ─────────────────────────────────────────────────────────────
   Per-panel window state helper
   ─────────────────────────────────────────────────────────── */
function usePanelWindow(pageWindow: TimeWindow) {
  const [override, setOverride] = useState<TimeWindow | null>(null);
  const win = override ?? pageWindow;
  return {
    win,
    override: override !== null,
    setOverride: (w: TimeWindow) => setOverride(w),
    clearOverride: () => setOverride(null),
  };
}
