import type { ReactNode } from 'react';
import './healthdonut.css';

/* ─────────────────────────────────────────────────────────────────────────
   Profile badges — emerald achievement chips + mini-stats, driven by REAL
   project data (no hardcoded numbers). Only genuinely-earned achievements
   render; mini-stats reflect actual counts. Self-styled in healthdonut.css.
   ───────────────────────────────────────────────────────────────────────── */

type Badge = { id: string; label: string; icon: ReactNode };

const ICON = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ICONS = {
  heals: <svg {...ICON}><path d="M13 2 4 13h7l-1 9 9-11h-7l1-9z" /></svg>,
  pr: <svg {...ICON}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5v7M18 15.5v-3a4 4 0 0 0-4-4H9" /></svg>,
  shield: <svg {...ICON}><path d="M9 12l2 2 4-4" /><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></svg>,
};

type Props = {
  totalTraces: number;
  hallucinationRate: number;   // 0..1 (ungrounded traces / total)
  healsResolved: number;
  healsOpen: number;
};

export function ProfileBadges({ totalTraces, hallucinationRate, healsResolved, healsOpen }: Props) {
  // Only surface achievements the project has actually earned.
  const earned: Badge[] = [];
  if (healsResolved >= 1) earned.push({ id: 'first-pr', label: 'First heal resolved', icon: ICONS.pr });
  const milestone = healsResolved >= 100 ? 100 : healsResolved >= 50 ? 50 : healsResolved >= 10 ? 10 : 0;
  if (milestone) earned.push({ id: 'heals', label: `${milestone} heals`, icon: ICONS.heals });
  if (totalTraces > 0 && hallucinationRate === 0) {
    earned.push({ id: 'zero', label: 'Zero hallucinations', icon: ICONS.shield });
  } else if (totalTraces > 0 && hallucinationRate < 0.01) {
    earned.push({ id: 'sub1', label: 'Sub-1% hallucinations', icon: ICONS.shield });
  }

  const stats: { id: string; v: string; l: string }[] = [
    { id: 'traces', v: totalTraces.toLocaleString('en-US'), l: 'traces' },
    { id: 'resolved', v: healsResolved.toLocaleString('en-US'), l: 'heals resolved' },
    { id: 'open', v: healsOpen.toLocaleString('en-US'), l: 'open heals' },
  ];

  return (
    <div className="pb-wrap">
      <div className="pb-section-lab">Achievements</div>
      <div className="pb-badges">
        {earned.length > 0 ? (
          earned.map((b) => (
            <span className="pb-badge" key={b.id}>
              <span className="pb-badge-ic">{b.icon}</span>
              {b.label}
            </span>
          ))
        ) : (
          <span className="pb-badge-empty">Achievements unlock as you resolve heals.</span>
        )}
      </div>

      <div className="pb-ministats">
        {stats.map((s) => (
          <div className="pb-ministat" key={s.id}>
            <span className="pb-ministat-v">{s.v}</span>
            <span className="pb-ministat-l">{s.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
