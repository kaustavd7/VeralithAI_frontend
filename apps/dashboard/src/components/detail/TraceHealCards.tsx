import { Link } from 'react-router-dom';
import { healsPath } from '../../lib/nav';
import type { HealCardRef } from '../../api/types';
import s from './detail.module.css';

/* Status label + colour — mirrors STATUS_META in routes/Heals.tsx so a card
   reads the same on the trace page as it does in the heal queue. */
const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'var(--accent)' },
  in_progress: { label: 'In progress', color: 'var(--cell-ig)' },
  pr_raised: { label: 'PR raised', color: 'var(--cell-cg)' },
  resolved: { label: 'Resolved', color: 'var(--cell-cg)' },
  failed: { label: 'Failed', color: 'var(--cell-cu)' },
  manually_fixed: { label: 'Fixed manually', color: 'var(--po-grey)' },
  wont_fix: { label: "Won't fix", color: 'var(--po-grey)' },
  superseded: { label: 'Superseded', color: 'var(--po-grey)' },
};

/**
 * "Fix for this trace" — the heal card(s) this failing trace is evidence for.
 * A trace can belong to more than one card (different failure families), so we
 * render the full list, newest first, each linking straight to the heal card.
 */
export function TraceHealCards({ slug, cards }: { slug: string; cards: HealCardRef[] }) {
  if (!cards.length) return null;
  const many = cards.length > 1;

  return (
    <div className={s.section} id="trace-fix">
      <div className={s.sectionHead}>
        <h2>{many ? 'Fixes for this trace' : 'Fix for this trace'}</h2>
        <span className={s.sectionSub}>
          {many
            ? `this trace is evidence for ${cards.length} heal cards`
            : 'this trace is evidence for 1 heal card'}
        </span>
      </div>

      <div className={s.healRefs}>
        {cards.map((c) => {
          const m = STATUS[c.status] ?? { label: c.status, color: 'var(--po-grey)' };
          return (
            <Link key={c.id} to={healsPath(slug, c.id)} className={s.healRef}>
              <span className={s.healRefDot} style={{ background: m.color }} />
              <span className={s.healRefMain}>
                <span className={s.healRefTitle}>{c.title}</span>
                <span className={s.healRefMeta}>
                  <code>{c.suggestion_slug}</code>
                  {c.is_recurrence && <span className={s.healRefRecur}>recurring</span>}
                </span>
              </span>
              <span className={s.healRefStatus} style={{ color: m.color }}>
                {m.label}
              </span>
              <svg className={s.healRefArrow} width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
