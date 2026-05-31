// Failure-cell taxonomy palette — SAGE ramp (light→dark = healthy→worst), matching
// the cell bubble chart and Failure Cells page. `ink` is the contrast-aware text
// color for chips that put text on the cell fill (dark on the two lightest, white
// on the rest). Kept in sync with the --fcell-* tokens in tokens.css.
export const CELL_META = {
  complete_grounded:     { label: 'complete_grounded',     color: '#DAD7CD', ink: '#2c3a28', short: 'CG' },
  complete_ungrounded:   { label: 'complete_ungrounded',   color: '#588157', ink: '#ffffff', short: 'CU' },
  incomplete_grounded:   { label: 'incomplete_grounded',   color: '#A3B18A', ink: '#26331f', short: 'IG' },
  incomplete_ungrounded: { label: 'incomplete_ungrounded', color: '#344E41', ink: '#ffffff', short: 'IU' },
  extra_grounded:        { label: 'extra_grounded',        color: '#76936A', ink: '#ffffff', short: 'EG' },
  extra_ungrounded:      { label: 'extra_ungrounded',      color: '#3A5A40', ink: '#ffffff', short: 'EU' },
} as const;

export type CellName = keyof typeof CELL_META;
