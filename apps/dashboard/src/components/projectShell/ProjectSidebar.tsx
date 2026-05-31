import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type SidebarNavId =
  | 'overview'
  | 'traces'
  | 'live'
  | 'analytics'
  | 'heals'
  | 'cells'
  | 'calibration'
  | 'judges'
  | 'chunks'
  | 'queue';

type Props = {
  active: SidebarNavId;
  slug: string;
};

type Item = {
  id: SidebarNavId;
  label: string;
  icon: keyof typeof ICONS;
  kbd?: string;
  badge?: string;
  /** route is undefined for disabled stubs */
  route?: string;
};

type Group = { label: string; items: Item[] };

function groups(slug: string): Group[] {
  return [
    {
      label: 'workspace',
      items: [
        { id: 'overview', label: 'Project overview', kbd: 'g o', icon: 'overview', route: `/projects/${slug}` },
        { id: 'traces', label: 'Trace explorer', kbd: 'g t', icon: 'traces', route: `/projects/${slug}/traces` },
        { id: 'live', label: 'Live stream', kbd: 'g l', icon: 'live' },
      ],
    },
    {
      label: 'diagnostics',
      items: [
        { id: 'analytics', label: 'Analytics', kbd: 'g a', icon: 'chart', route: `/projects/${slug}/analytics` },
        { id: 'heals', label: 'Heals', kbd: 'g h', icon: 'heal', route: `/heals` },
        { id: 'cells', label: 'Failure cells', kbd: 'g f', icon: 'cells' },
        { id: 'calibration', label: 'Calibration', kbd: 'g c', icon: 'calib' },
      ],
    },
    {
      label: 'pipeline',
      items: [
        { id: 'judges', label: 'Judges', icon: 'judges' },
        { id: 'chunks', label: 'Retrieval chunks', icon: 'chunks' },
        { id: 'queue', label: 'Worker queue', icon: 'queue' },
      ],
    },
  ];
}

const ICONS = {
  overview: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </>
  ),
  traces: <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />,
  live: (
    <>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  chart: <path d="M2 13l3-6 3 3 3-7 3 5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />,
  heal: (
    <>
      <path d="M2 8h12M8 2v12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </>
  ),
  cells: (
    <>
      <rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="9" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="2" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </>
  ),
  calib: (
    <>
      <path d="M3 11.5l5-7 5 7" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      <circle cx="8" cy="11.5" r="0.9" fill="currentColor" />
    </>
  ),
  judges: (
    <>
      <circle cx="4" cy="4" r="1.4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="4" r="1.4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4" cy="12" r="1.4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="1.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.2 5.2L10.8 10.8M10.8 5.2L5.2 10.8" stroke="currentColor" strokeWidth="1.1" />
    </>
  ),
  chunks: (
    <>
      <rect x="2" y="3" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="2" y="7" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="2" y="11" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </>
  ),
  queue: <path d="M3 3h10v10H3z M3 6h10 M6 6v7" stroke="currentColor" strokeWidth="1.3" fill="none" />,
  brand: (
    <>
      <path
        d="M11 2 L20 18 L2 18 Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M11 2 L11 18" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.55" />
      <path d="M6.5 12 L15.5 12" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.55" />
    </>
  ),
};

function SbIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="sb-ic" width="16" height="16" viewBox="0 0 16 16">
      {ICONS[name]}
    </svg>
  );
}

export function ProjectSidebar({ active, slug }: Props) {
  const [hover, setHover] = useState(false);
  const navigate = useNavigate();

  return (
    <aside
      className={'sb' + (hover ? ' is-expanded' : '')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="sb-brand">
        <span className="sb-brand-mark">
          <svg width="20" height="20" viewBox="0 0 22 22">
            {ICONS.brand}
          </svg>
        </span>
        <span className="sb-brand-name">veralith</span>
        <span className="sb-brand-env">local</span>
      </div>

      <div className="sb-scroll">
        {groups(slug).map((g) => (
          <div className="sb-group" key={g.label}>
            <div className="sb-group-label">{g.label}</div>
            {g.items.map((it) => {
              const disabled = !it.route;
              const isActive = active === it.id;
              const className =
                'sb-item' +
                (isActive ? ' is-active' : '') +
                (disabled ? ' is-disabled' : '');
              return (
                <div
                  key={it.id}
                  className={className}
                  data-tip={it.label}
                  onClick={() => {
                    if (disabled || !it.route) return;
                    navigate(it.route);
                  }}
                  role={disabled ? undefined : 'link'}
                >
                  <span className="sb-item-ic">
                    <SbIcon name={it.icon} />
                  </span>
                  <span className="sb-item-label">{it.label}</span>
                  {it.badge && <span className="sb-item-badge">{it.badge}</span>}
                  {it.kbd && <span className="sb-item-kbd">{it.kbd}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sb-foot">
        <div className="sb-foot-status">
          <span className="sb-live-dot" />
          <span className="sb-foot-label">Connected</span>
          <span className="sb-foot-sub">v0.2</span>
        </div>
      </div>
    </aside>
  );
}
