import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { LiveStatus } from './LiveStatus';
import styles from './shell.module.css';

// Inline-SVG icons, ported verbatim from the wireframe.
const IconOverview = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
const IconTraces = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const IconClaims = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <path d="M3 13V7l5-4 5 4v6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
    <path d="M6 13v-3h4v3" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
const IconLive = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const IconStats = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <path d="M2 13l3-6 3 3 3-7 3 5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
  </svg>
);
const IconCells = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <path d="M3 8h2l2-5 2 10 2-5h2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
  </svg>
);
const IconCalibration = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <path d="M3 11.5l5-7 5 7" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
    <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
  </svg>
);
const IconJudges = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <circle cx="4" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="12" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="4" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="12" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.2 5.2L10.8 10.8M10.8 5.2L5.2 10.8" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);
const IconChunks = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
    <rect x="2" y="7" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
    <rect x="2" y="11" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
const IconQueue = (
  <svg className={styles.ic} viewBox="0 0 16 16" fill="none">
    <path d="M3 3h10v10H3z M3 6h10 M6 6v7" stroke="currentColor" strokeWidth="1.3" fill="none" />
  </svg>
);

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  route?: string;        // target route or '#anchor'
  count?: string;        // mono right-aligned count
  dot?: boolean;         // live indicator instead of count
  disabled?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Data-driven nav — Phase 0.2.5 will add a "Heal sessions" item to the
// Diagnostics group; no JSX change required, just append an object here.
export const DEFAULT_NAV: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'overview',   label: 'Overview',    icon: IconOverview, route: '#top' },
      { id: 'traces',     label: 'Traces',      icon: IconTraces,   route: '#recent-traces', count: '1,247' },
      { id: 'claims',     label: 'Claims',      icon: IconClaims,   disabled: true },
      { id: 'live',       label: 'Live stream', icon: IconLive,     route: '#recent-traces', dot: true },
    ],
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    items: [
      { id: 'stats',       label: 'Stats & trends', icon: IconStats,       route: '#sf-card' },
      { id: 'cells',       label: 'Failure cells',  icon: IconCells,       route: '#dist-card' },
      { id: 'calibration', label: 'Calibration',    icon: IconCalibration, count: '0.85' },
    ],
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    items: [
      { id: 'judges',  label: 'Judges',           icon: IconJudges, disabled: true },
      { id: 'chunks',  label: 'Retrieval chunks', icon: IconChunks, disabled: true },
      { id: 'queue',   label: 'Worker queue',     icon: IconQueue,  count: '3' },
    ],
  },
];

interface Props {
  groups?: NavGroup[];
  activeId?: string;
  onSelect?: (item: NavItem) => void;
}

export function Sidebar({ groups = DEFAULT_NAV, activeId = 'overview', onSelect }: Props) {
  return (
    <aside className={styles.side}>
      <Brand />

      <div className={styles.search}>
        <input type="text" placeholder="Find trace, claim…" />
        <span className={styles.kbd}>⌘K</span>
      </div>

      <nav className={styles.nav}>
        {groups.map((g) => (
          <div key={g.id}>
            <div className={styles.groupLabel}>{g.label}</div>
            {g.items.map((item) => {
              const className = [
                styles.item,
                item.id === activeId ? styles.active : '',
                item.disabled ? styles.disabled : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={item.id}
                  type="button"
                  className={className}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    if (item.route?.startsWith('#')) {
                      const target = item.route === '#top' ? null : document.querySelector(item.route);
                      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      else window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    onSelect?.(item);
                  }}
                >
                  {item.icon}
                  {item.label}
                  {item.count && <span className={styles.count}>{item.count}</span>}
                  {item.dot && <span className={styles.dot} />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <LiveStatus />
    </aside>
  );
}
