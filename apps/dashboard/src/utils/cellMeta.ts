export const CELL_META = {
  complete_grounded:     { label: 'complete_grounded',     color: '#4ea872', short: 'CG' },
  complete_ungrounded:   { label: 'complete_ungrounded',   color: '#e25c5c', short: 'CU' },
  incomplete_grounded:   { label: 'incomplete_grounded',   color: '#e0a14a', short: 'IG' },
  incomplete_ungrounded: { label: 'incomplete_ungrounded', color: '#b53636', short: 'IU' },
  extra_grounded:        { label: 'extra_grounded',        color: '#d4c84a', short: 'EG' },
  extra_ungrounded:      { label: 'extra_ungrounded',      color: '#e25c5c', short: 'EU' },
} as const;

export type CellName = keyof typeof CELL_META;
