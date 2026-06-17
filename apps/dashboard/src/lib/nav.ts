import type { FailureCell } from '../api/types';

/* ─────────────────────────────────────────────────────────────────────────
   Shared navigation helpers for the dashboard's internal drill-down links.
   The 6 failure cells appear in two notations across the app: full slugs
   ('complete_ungrounded') in the API/types, and short codes ('cu','ig',…) in
   some demo components. normalizeCell() accepts either. The Trace Explorer
   reads ?cells= from the URL and pre-filters, so tracesPath(slug, cell) lands
   on a filtered trace list.
   ───────────────────────────────────────────────────────────────────────── */

const SHORT_TO_FULL: Record<string, FailureCell> = {
  cg: 'complete_grounded',
  cu: 'complete_ungrounded',
  ig: 'incomplete_grounded',
  iu: 'incomplete_ungrounded',
  eg: 'extra_grounded',
  eu: 'extra_ungrounded',
};

const FULL_CELLS = Object.values(SHORT_TO_FULL) as string[];

/** Accept a short code ('cu') or a full slug ('complete_ungrounded'); return the full slug, or undefined if unrecognized. */
export function normalizeCell(cell: string): FailureCell | undefined {
  if (cell in SHORT_TO_FULL) return SHORT_TO_FULL[cell];
  return FULL_CELLS.includes(cell) ? (cell as FailureCell) : undefined;
}

/** Trace Explorer, optionally pre-filtered to one failure cell. */
export function tracesPath(slug: string, cell?: string): string {
  const base = `/projects/${slug}/traces`;
  if (!cell) return base;
  const full = normalizeCell(cell);
  return full ? `${base}?cells=${full}` : base;
}

export function traceDetailPath(slug: string, traceId: string): string {
  return `/projects/${slug}/traces/${traceId}`;
}

export function healsPath(slug: string, cardId?: string): string {
  return cardId ? `/projects/${slug}/heals/${cardId}` : `/projects/${slug}/heals`;
}

export function cellsPath(slug: string): string {
  return `/projects/${slug}/analytics/cells`;
}

export function analyticsPath(slug: string): string {
  return `/projects/${slug}/analytics`;
}
