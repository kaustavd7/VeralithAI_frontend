// Failure-cell taxonomy palette — SAGE ramp (light→dark = healthy→worst), matching
// the cell bubble chart and Failure Cells page. `ink` is the contrast-aware text
// color for chips that put text on the cell fill (dark on the two lightest, white
// on the rest). Kept in sync with the --fcell-* tokens in tokens.css.
export const CELL_META = {
  complete_grounded:     { label: 'complete_grounded',     color: 'var(--fcell-cg)', ink: '#2c3a28', short: 'CG' },
  complete_ungrounded:   { label: 'complete_ungrounded',   color: 'var(--fcell-cu)', ink: '#ffffff', short: 'CU' },
  incomplete_grounded:   { label: 'incomplete_grounded',   color: 'var(--fcell-ig)', ink: '#26331f', short: 'IG' },
  incomplete_ungrounded: { label: 'incomplete_ungrounded', color: 'var(--fcell-iu)', ink: '#ffffff', short: 'IU' },
  extra_grounded:        { label: 'extra_grounded',        color: 'var(--fcell-eg)', ink: '#ffffff', short: 'EG' },
  extra_ungrounded:      { label: 'extra_ungrounded',      color: 'var(--fcell-eu)', ink: '#ffffff', short: 'EU' },
} as const;

export type CellName = keyof typeof CELL_META;
