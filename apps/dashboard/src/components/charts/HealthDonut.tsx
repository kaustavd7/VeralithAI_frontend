import { useMemo } from 'react';
import './healthdonut.css';

/* ─────────────────────────────────────────────────────────────────────────
   Health donut — an SVG ring of the trace failure-cell distribution, in the
   LeetCode-profile spirit. The healthy share (complete·grounded) is rendered
   in emerald var(--accent); every other slice uses its cell semantics via the
   --cell-* tokens (amber for incomplete·grounded, reds for the ungrounded
   cells, etc.). Center reads the healthy % as a big tabular number.
   Demo data is deterministic and matches Trace Explorer's cell counts.
   ───────────────────────────────────────────────────────────────────────── */

type Slice = { id: string; label: string; count: number; color: string };

/* Deterministic demo distribution — kept in sync with Trace Explorer's cell
   counts. complete·grounded is the healthy bucket → emerald accent; the rest
   carry their cell-semantic color. Ordered worst→best around the ring so the
   emerald healthy arc closes the loop. */
const SLICES: Slice[] = [
  { id: 'incomplete_ungrounded', label: 'incomplete · ungrounded', count: 5, color: 'var(--cell-iu)' },
  { id: 'complete_ungrounded', label: 'complete · ungrounded', count: 24, color: 'var(--cell-cu)' },
  { id: 'extra_ungrounded', label: 'extra · ungrounded', count: 7, color: 'var(--cell-eu)' },
  { id: 'incomplete_grounded', label: 'incomplete · grounded', count: 87, color: 'var(--cell-ig)' },
  { id: 'extra_grounded', label: 'extra · grounded', count: 41, color: 'var(--cell-eg)' },
  { id: 'complete_grounded', label: 'complete · grounded', count: 1083, color: 'var(--accent)' },
];
const HEALTHY_ID = 'complete_grounded';

/* ring geometry */
const SIZE = 168;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const C = SIZE / 2;
const CIRC = 2 * Math.PI * R;
const GAP = 0.014; // fraction of the circumference left blank between slices

/* Build the same ordered slices from a live { cell: count } map (falls back to
   the demo distribution when no counts are passed). */
function slicesFromCounts(counts: Record<string, number>): Slice[] {
  return SLICES.map((s) => ({ ...s, count: counts[s.id] ?? 0 }));
}

export function HealthDonut({
  onCellClick,
  counts,
}: {
  onCellClick?: (cell: string) => void;
  counts?: Record<string, number>;
} = {}) {
  const { total, healthyPct, arcs } = useMemo(() => {
    const slices = counts ? slicesFromCounts(counts) : SLICES;
    const total = slices.reduce((a, s) => a + s.count, 0);
    const healthy = slices.find((s) => s.id === HEALTHY_ID)?.count ?? 0;
    const healthyPct = total ? (healthy / total) * 100 : 0;
    // cumulative start fraction for each slice (prefix sum of preceding fracs;
    // no post-render mutation of an outer variable)
    const arcs = slices.map((s, i) => {
      const frac = total ? s.count / total : 0;
      const startFrac = total ? slices.slice(0, i).reduce((a, p) => a + p.count, 0) / total : 0;
      const dash = Math.max(0, frac - GAP) * CIRC;
      const offset = -startFrac * CIRC;
      return { ...s, dash, offset };
    });
    return { total, healthyPct, arcs };
  }, [counts]);

  return (
    <div className="hd-wrap">
      <div className="hd-ring" role="img" aria-label={`${healthyPct.toFixed(1)} percent healthy traces`}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="hd-svg">
          {/* track */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--po-line)" strokeWidth={STROKE} />
          {/* slices — drawn from the top (rotate -90°) */}
          <g transform={`rotate(-90 ${C} ${C})`}>
            {arcs.map((a) => (
              <circle
                key={a.id}
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={STROKE}
                strokeLinecap="butt"
                strokeDasharray={`${a.dash} ${CIRC - a.dash}`}
                strokeDashoffset={a.offset}
                className={'hd-arc' + (a.id === HEALTHY_ID ? ' is-healthy' : '')}
                style={onCellClick ? { cursor: 'pointer' } : undefined}
                onClick={onCellClick ? () => onCellClick(a.id) : undefined}
                role={onCellClick ? 'link' : undefined}
                aria-label={onCellClick ? `View ${a.label} traces` : undefined}
              />
            ))}
          </g>
        </svg>
        <div className="hd-center">
          <div className="hd-pct">{healthyPct.toFixed(1)}<span className="hd-pct-sym">%</span></div>
          <div className="hd-pct-lab">healthy</div>
        </div>
      </div>

      <ul className="hd-legend">
        {arcs.map((a) => (
          <li
            className="hd-leg-row"
            key={a.id}
            style={onCellClick ? { cursor: 'pointer' } : undefined}
            role={onCellClick ? 'link' : undefined}
            tabIndex={onCellClick ? 0 : undefined}
            aria-label={onCellClick ? `View ${a.label} traces` : undefined}
            onClick={onCellClick ? () => onCellClick(a.id) : undefined}
            onKeyDown={
              onCellClick
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                      e.preventDefault();
                      onCellClick(a.id);
                    }
                  }
                : undefined
            }
          >
            <span className="hd-leg-sw" style={{ background: a.color }} />
            <span className="hd-leg-name">{a.label}</span>
            <span className="hd-leg-count">{a.count.toLocaleString('en-US')}</span>
          </li>
        ))}
        <li className="hd-leg-row hd-leg-total">
          <span className="hd-leg-sw hd-leg-sw-empty" />
          <span className="hd-leg-name">total traces</span>
          <span className="hd-leg-count">{total.toLocaleString('en-US')}</span>
        </li>
      </ul>
    </div>
  );
}
