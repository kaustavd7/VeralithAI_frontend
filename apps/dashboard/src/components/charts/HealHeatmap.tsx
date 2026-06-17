import { useMemo, useState } from 'react';
import './heatmap.css';

/* ─────────────────────────────────────────────────────────────────────────
   Heal contribution calendar — GitHub-submission-style heatmap of self-heals
   per day over the last ~12 months. Emerald intensity ramp (0→4).
   Demo data is deterministic (seeded) so the calendar is stable; pass real
   per-day counts via `counts` (keyed 'YYYY-MM-DD') when wired to the API.
   ───────────────────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;
const WEEKS = 53;
const PITCH = 15; // cell 12px + 3px gap — drives tooltip + month-label positions
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Cell = { date: Date; count: number; future: boolean };

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function levelOf(c: number): number {
  if (c <= 0) return 0;
  if (c === 1) return 1;
  if (c <= 3) return 2;
  if (c <= 5) return 3;
  return 4;
}

function useCalendar(counts?: Record<string, number>) {
  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay())); // pad out to the upcoming Saturday
    const start = new Date(end);
    start.setDate(start.getDate() - (WEEKS * 7 - 1)); // a Sunday, 53 full weeks back

    const rnd = seeded(0x5e1fab);
    const weeks: Cell[][] = [];
    let week: Cell[] = [];
    let total = 0;

    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      const date = new Date(t);
      const future = date.getTime() > today.getTime();
      let count = 0;
      if (!future) {
        if (counts) {
          count = counts[dateKey(date)] ?? 0;
        } else {
          const r = rnd();
          const wd = date.getDay();
          const boost = wd >= 1 && wd <= 5 ? 0.1 : 0; // weekdays heal a touch more
          if (r > 0.74 - boost) count = 1 + Math.floor(rnd() * (r > 0.94 ? 7 : 3));
        }
        total += count;
      }
      week.push({ date, count, future });
      if (week.length === 7) { weeks.push(week); week = []; }
    }

    const months: { col: number; label: string }[] = [];
    let lastM = -1;
    weeks.forEach((w, i) => {
      const m = w[0].date.getMonth();
      if (m !== lastM) { months.push({ col: i, label: MONTHS[m] }); lastM = m; }
    });

    const flat = weeks.flat().filter((c) => !c.future);
    let longest = 0, run = 0, current = 0;
    for (const c of flat) { if (c.count > 0) { run++; longest = Math.max(longest, run); } else run = 0; }
    for (let i = flat.length - 1; i >= 0; i--) { if (flat[i].count > 0) current++; else break; }

    return { weeks, months, total, longest, current };
  }, [counts]);
}

export function HealHeatmap({ counts }: { counts?: Record<string, number> }) {
  const { weeks, months, total, longest, current } = useCalendar(counts);
  const [hover, setHover] = useState<{ col: number; row: number; cell: Cell } | null>(null);

  return (
    <div className="hm">
      <div className="hm-top">
        <div className="hm-stat"><b>{total.toLocaleString()}</b> heals in the last year</div>
        <div className="hm-stat-r">
          <span><b>{current}</b>-day streak</span>
          <span className="hm-dot-sep">·</span>
          <span>longest <b>{longest}</b></span>
        </div>
      </div>

      <div className="hm-board">
        <div className="hm-dows">
          {DOW.map((d, i) => (
            <span key={d} className="hm-dow">{i % 2 === 1 ? d : ''}</span>
          ))}
        </div>
        <div className="hm-grid-col">
          <div className="hm-months">
            {months.map((m) => (
              <span key={m.col} className="hm-month" style={{ left: m.col * PITCH }}>{m.label}</span>
            ))}
          </div>
          <div className="hm-weeks" onMouseLeave={() => setHover(null)}>
            {weeks.map((w, wi) => (
              <div className="hm-week" key={wi}>
                {w.map((c, di) => (
                  <i
                    key={di}
                    className={'hm-cell' + (c.future ? ' is-future' : '')}
                    data-lvl={levelOf(c.count)}
                    onMouseEnter={() => !c.future && setHover({ col: wi, row: di, cell: c })}
                  />
                ))}
              </div>
            ))}
            {hover && (
              <div className="hm-tip" style={{ left: hover.col * PITCH + 6, top: hover.row * PITCH }}>
                <b>{hover.cell.count === 0 ? 'No heals' : `${hover.cell.count} ${hover.cell.count === 1 ? 'heal' : 'heals'}`}</b>
                <span>{fmtDate(hover.cell.date)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hm-legend">
        <span className="hm-legend-l">Less</span>
        {[0, 1, 2, 3, 4].map((l) => <i key={l} className="hm-cell" data-lvl={l} />)}
        <span className="hm-legend-l">More</span>
      </div>
    </div>
  );
}
