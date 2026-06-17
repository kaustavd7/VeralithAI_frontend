import type { ReactNode } from 'react';
import './healthdonut.css';

/* ─────────────────────────────────────────────────────────────────────────
   Profile badges — a row of emerald-tinted achievement chips, each with a
   tiny inline SVG icon (LeetCode-profile spirit). Paired with a few mini-stats
   to fill the right half of the profile card. Self-styled in healthdonut.css.
   ───────────────────────────────────────────────────────────────────────── */

type Badge = { id: string; label: string; icon: ReactNode };

const ICON = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const BADGES: Badge[] = [
  {
    id: 'heals',
    label: '100 heals',
    icon: (
      <svg {...ICON}><path d="M13 2 4 13h7l-1 9 9-11h-7l1-9z" /></svg>
    ),
  },
  {
    id: 'first-pr',
    label: 'First PR merged',
    icon: (
      <svg {...ICON}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5v7M18 15.5v-3a4 4 0 0 0-4-4H9" /></svg>
    ),
  },
  {
    id: 'streak',
    label: '7-day streak',
    icon: (
      <svg {...ICON}><path d="M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-1.8.9-3.4 2-4.5C9 9 12 8 12 2z" /></svg>
    ),
  },
  {
    id: 'sub1',
    label: 'Sub-1% hallucinations',
    icon: (
      <svg {...ICON}><path d="M9 12l2 2 4-4" /><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></svg>
    ),
  },
];

const MINI_STATS: { id: string; v: string; l: string }[] = [
  { id: 'rank', v: '#42', l: 'heal rank' },
  { id: 'best', v: '14d', l: 'best streak' },
  { id: 'total', v: '1,247', l: 'traces healed' },
];

export function ProfileBadges() {
  return (
    <div className="pb-wrap">
      <div className="pb-section-lab">Achievements</div>
      <div className="pb-badges">
        {BADGES.map((b) => (
          <span className="pb-badge" key={b.id}>
            <span className="pb-badge-ic">{b.icon}</span>
            {b.label}
          </span>
        ))}
      </div>

      <div className="pb-ministats">
        {MINI_STATS.map((s) => (
          <div className="pb-ministat" key={s.id}>
            <span className="pb-ministat-v">{s.v}</span>
            <span className="pb-ministat-l">{s.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
