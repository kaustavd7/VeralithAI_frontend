import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSidebarMode, type SidebarMode } from '../../lib/sidebarMode';
import { useProjects } from '../../hooks/useProjects';
import { api } from '../../api/client';

// Heal-card statuses that need the user's attention (drive the sidebar count).
const HEAL_ATTENTION_STATUSES = new Set(['open', 'pr_raised', 'failed']);

export type SidebarNavId =
  | 'overview'
  | 'traces'
  | 'apiKeys'
  | 'analytics'
  | 'heals'
  | 'cells'
  // workspace-level (top of the app, no project selected)
  | 'projects'
  | 'billing'
  | 'wsSettings';

type Variant = 'project' | 'workspace';

type Props = {
  active: string;
  slug?: string;
  variant?: Variant;
  /** mobile drawer: open state + a request to close (after navigation / backdrop tap) */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

type Item = {
  id: string;
  label: string;
  icon: keyof typeof ICONS;
  kbd?: string;
  badge?: string;
  /** route is undefined for disabled stubs */
  route?: string;
};

type Group = { label: string; items: Item[] };

function projectGroups(slug: string): Group[] {
  return [
    {
      label: 'workspace',
      items: [
        { id: 'overview', label: 'Project overview', kbd: 'g o', icon: 'overview', route: `/projects/${slug}` },
        { id: 'traces', label: 'Trace explorer', kbd: 'g t', icon: 'traces', route: `/projects/${slug}/traces` },
      ],
    },
    {
      label: 'diagnostics',
      items: [
        { id: 'analytics', label: 'Analytics', kbd: 'g a', icon: 'chart', route: `/projects/${slug}/analytics` },
        { id: 'heals', label: 'Heals', kbd: 'g h', icon: 'heal', route: `/projects/${slug}/heals` },
        { id: 'cells', label: 'Failure cells', kbd: 'g f', icon: 'cells', route: `/projects/${slug}/analytics/cells` },
      ],
    },
  ];
}

function workspaceGroups(): Group[] {
  return [
    {
      label: 'workspace',
      items: [
        { id: 'projects', label: 'Projects', kbd: 'g p', icon: 'projects', route: '/projects' },
        { id: 'wsSettings', label: 'Workspace settings', kbd: 'g s', icon: 'settings', route: '/settings' },
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
  key: (
    <>
      <circle cx="5.5" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M8.3 8H14M11.5 8v2.4M13.2 8v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  live: (
    <>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  chart: <path d="M2 13l3-6 3 3 3-7 3 5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />,
  heal: (
    <path
      d="M8 13.3C8 13.3 2 9.6 2 5.6 2 3.9 3.3 2.7 4.9 2.7 6 2.7 7.1 3.4 8 4.6 8.9 3.4 10 2.7 11.1 2.7 12.7 2.7 14 3.9 14 5.6 14 9.6 8 13.3 8 13.3Z"
      stroke="currentColor"
      strokeWidth="1.3"
      fill="none"
      strokeLinejoin="round"
    />
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
  projects: (
    <>
      <path d="M8 1.8 L13.6 5 L13.6 11 L8 14.2 L2.4 11 L2.4 5 Z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      <path d="M2.4 5 L8 8.2 L13.6 5 M8 8.2 L8 14.2" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.55" fill="none" strokeLinejoin="round" />
    </>
  ),
  billing: (
    <>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path
        d="M8 1.5v2.1M8 12.4v2.1M1.5 8h2.1M12.4 8h2.1M3.4 3.4l1.5 1.5M11.1 11.1l1.5 1.5M12.6 3.4l-1.5 1.5M4.9 11.1l-1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
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

/* Slide-out shortcut tooltip: "Go to X" + keycaps (G then F). Appears promptly to
   the right of the 56px rail on hover — ONLY while the sidebar is collapsed (i.e.
   the inline label is hidden). When expanded the label is already visible, so CSS
   suppresses the tip. Escapes the rail because .sb / .sb-scroll are overflow:visible. */
function SbTip({ label, kbd }: { label: string; kbd?: string }) {
  const keys = kbd ? kbd.trim().split(/\s+/) : [];
  return (
    <span className="sb-tip" role="tooltip" aria-hidden="true">
      <span className="sb-tip-label">Go to {label}</span>
      {keys.length > 0 && (
        <span className="sb-tip-keys">
          {keys.map((k, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="sb-tip-then">then</span>}
              <kbd className="sb-tip-key">{k.toUpperCase()}</kbd>
            </Fragment>
          ))}
        </span>
      )}
    </span>
  );
}

// Click cycles through the modes (Spotify-loop style): expanded → expand-on-hover → collapsed → …
const MODE_CYCLE: SidebarMode[] = ['expanded', 'hover', 'collapsed'];
const MODE_LABEL: Record<SidebarMode, string> = {
  expanded: 'Expanded',
  hover: 'Expand on hover',
  collapsed: 'Collapsed',
};

function SidebarControl() {
  const [mode, setMode] = useSidebarMode();
  const cycle = () => setMode(MODE_CYCLE[(MODE_CYCLE.indexOf(mode) + 1) % MODE_CYCLE.length]);

  return (
    <div className="sb-ctrl">
      <button
        type="button"
        className={'sb-ctrl-btn sb-ctrl-' + mode}
        onClick={cycle}
        aria-label={`Sidebar: ${MODE_LABEL[mode]} — click to change`}
        title={`Sidebar: ${MODE_LABEL[mode]}`}
      >
        <PanelIcon mode={mode} />
      </button>
    </div>
  );
}

function PanelIcon({ mode }: { mode: SidebarMode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
      {mode === 'expanded' && <rect x="2.7" y="3.7" width="3.3" height="8.6" rx="0.8" fill="currentColor" />}
      {mode === 'collapsed' && <path d="M6 3v10" stroke="currentColor" strokeWidth="1.3" />}
      {mode === 'hover' && (
        <path d="M6 3v10" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.6" />
      )}
    </svg>
  );
}

export function ProjectSidebar({ active, slug = '', variant = 'project', mobileOpen = false, onMobileClose }: Props) {
  const [hover, setHover] = useState(false);
  const [mode] = useSidebarMode();
  const navigate = useNavigate();

  // collapsed → never expands; expanded → always; hover → on cursor rest.
  const expanded = mode === 'expanded' || (mode === 'hover' && hover);
  const grps = variant === 'workspace' ? workspaceGroups() : projectGroups(slug);

  // Per-section notification counts (WhatsApp-style). Heals: cards awaiting the
  // user's action (open / pr_raised / failed). Shares the ['heals', …] cache with
  // the Heals page; polls modestly so the badge stays fresh from any page.
  const projects = useProjects();
  const projectId = useMemo(
    () => projects.data?.projects.find((p) => p.slug === slug || p.id === slug)?.id ?? null,
    [projects.data, slug],
  );
  const healsQuery = useQuery({
    queryKey: ['heals', projectId, 'all'],
    queryFn: () => api.listHeals({ limit: 100 }),
    enabled: variant === 'project' && !!projectId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const navCounts = useMemo<Record<string, number>>(() => {
    const cards = healsQuery.data ?? [];
    const healCount = projectId
      ? cards.filter((c) => c.project_id === projectId && HEAL_ATTENTION_STATUSES.has(c.status)).length
      : 0;
    return { heals: healCount };
  }, [healsQuery.data, projectId]);

  // Leader-key chord map built from each item's `kbd` hint (e.g. "g t" → route),
  // so the live shortcuts can never drift from the tooltips that advertise them.
  const chords = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const g of grps) {
      for (const it of g.items) {
        if (!it.kbd || !it.route) continue;
        const parts = it.kbd.trim().toLowerCase().split(/\s+/);
        if (parts.length !== 2) continue;
        const [leader, key] = parts;
        (map[leader] ||= {})[key] = it.route;
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, variant]);

  // Sequential nav shortcuts (Linear/Railway-style): press the leader (g), then a
  // key, to jump to a section. Ignored while typing or when a modal is open.
  const pendingRef = useRef<{ leader: string; timer: number } | null>(null);
  useEffect(() => {
    function clearPending() {
      if (pendingRef.current) {
        window.clearTimeout(pendingRef.current.timer);
        pendingRef.current = null;
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      // a bare modifier press mid-chord shouldn't cancel the pending leader
      if (key === 'shift' || key === 'control' || key === 'alt' || key === 'meta') return;
      // never hijack typing or a key handled by an open modal dialog
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      const pending = pendingRef.current;
      if (pending) {
        const route = chords[pending.leader]?.[key];
        clearPending();
        if (route) {
          e.preventDefault();
          navigate(route);
        }
        return;
      }
      if (chords[key]) {
        // arm the chord; auto-disarm if the next key doesn't come quickly
        pendingRef.current = { leader: key, timer: window.setTimeout(clearPending, 1400) };
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearPending();
    };
  }, [chords, navigate]);

  return (
    <>
      {mobileOpen && <div className="sb-backdrop" onClick={onMobileClose} aria-hidden="true" />}
    <aside
      className={'sb sb-mode-' + mode + (expanded ? ' is-expanded' : '') + (mobileOpen ? ' is-mobile-open' : '')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="sb-scroll">
        {grps.map((g) => (
          <div className="sb-group" key={g.label}>
            <div className="sb-group-label">{g.label}</div>
            {g.items.map((it) => {
              const disabled = !it.route;
              const isActive = active === it.id;
              const className =
                'sb-item' + (isActive ? ' is-active' : '') + (disabled ? ' is-disabled' : '');
              return (
                <div
                  key={it.id}
                  className={className}
                  onClick={() => {
                    if (disabled || !it.route) return;
                    navigate(it.route);
                    onMobileClose?.();
                  }}
                  role={disabled ? undefined : 'link'}
                >
                  <span className="sb-item-ic">
                    <SbIcon name={it.icon} />
                    {navCounts[it.id] > 0 && (
                      <span
                        className="sb-item-count"
                        aria-label={`${navCounts[it.id]} awaiting attention`}
                      >
                        {navCounts[it.id] > 9 ? '9+' : navCounts[it.id]}
                      </span>
                    )}
                  </span>
                  <span className="sb-item-label">{it.label}</span>
                  {it.badge && <span className="sb-item-badge">{it.badge}</span>}
                  <SbTip label={it.label} kbd={it.kbd} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <SidebarControl />
    </aside>
    </>
  );
}
