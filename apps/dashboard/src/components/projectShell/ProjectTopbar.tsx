import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useProjects } from '../../hooks/useProjects';
import { api } from '../../api/client';
import { AccountMenu } from './AccountMenu';
import { ConnectionChip } from './ConnectionChip';
import { BrandMark } from '../brand/Brand';

type Props = {
  workspace?: string;
  /** when set, the topbar appends the `/ project ⌄` switcher; omit at the workspace level */
  project?: string;
  /** opens the mobile nav drawer (hamburger is shown only on small screens) */
  onMenu?: () => void;
};

// The topbar badge reflects the user's REAL access state, derived from
// subscription_status + the trial clock (mirrors the backend entitlement rule
// in services/entitlements.py):
//   active / past_due            -> paid plan name ("Pro"/"Team"/…)
//   trialing & not yet expired   -> "Trial" (full access, time-limited)
//   trialing-expired / canceled  -> "Free" (locked out of the paid surface)
const PAID_PLAN_LABEL: Record<string, string> = { pro: 'Pro', team: 'Team', max: 'Max' };

function planBadge(me?: {
  subscription_status: string;
  plan_tier: string;
  trial_expires_at: string;
}): { label: string; kind: 'free' | 'trial' | 'paid' } | null {
  if (!me) return null;
  if (me.subscription_status === 'active' || me.subscription_status === 'past_due') {
    const label =
      PAID_PLAN_LABEL[me.plan_tier] ??
      (me.plan_tier ? me.plan_tier.charAt(0).toUpperCase() + me.plan_tier.slice(1) : 'Pro');
    return { label, kind: 'paid' };
  }
  if (me.subscription_status === 'trialing') {
    const expired = new Date(me.trial_expires_at).getTime() <= Date.now();
    return expired ? { label: 'Free', kind: 'free' } : { label: 'Trial', kind: 'trial' };
  }
  return { label: 'Free', kind: 'free' }; // canceled / anything unrecognized
}

export function ProjectTopbar({ workspace = 'workspace', project, onMenu }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [q, setQ] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { slug = '' } = useParams<{ slug: string }>();
  const projectsQuery = useProjects();
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => api.getMe() });

  const badge = planBadge(meQuery.data);

  const projects = projectsQuery.data?.projects ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(s) || p.slug.toLowerCase().includes(s),
    );
  }, [projects, q]);

  const switchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!switchOpen) return;
    function onDoc(e: MouseEvent) {
      if (switchRef.current && !switchRef.current.contains(e.target as Node)) {
        setSwitchOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [switchOpen]);

  // "<Name>'s workspace" derived from the auth user. useAuth resolves async on
  // every mount, so we cache the last-known label and show it immediately to
  // avoid flashing the "workspace" fallback on navigation/reload.
  const derivedLabel = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    const name = full ?? user?.email?.split('@')[0] ?? '';
    return name ? `${name}'s workspace` : '';
  }, [user]);

  const [workspaceLabel, setWorkspaceLabel] = useState<string>(() => {
    try {
      return localStorage.getItem('veralith.workspaceName') ?? '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (derivedLabel && derivedLabel !== workspaceLabel) {
      setWorkspaceLabel(derivedLabel);
      try {
        localStorage.setItem('veralith.workspaceName', derivedLabel);
      } catch {
        /* ignore */
      }
    }
  }, [derivedLabel, workspaceLabel]);

  const initials = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    const seed = full ?? user?.email ?? '';
    const parts = seed.split(/[\s@._-]/).filter(Boolean);
    if (parts.length === 0) return '·';
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
    return (first + second).toUpperCase();
  }, [user]);

  return (
    <div className="tb">
      <button type="button" className="tb-menu" aria-label="Open menu" onClick={onMenu}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="tb-crumbs">
        <button type="button" className="tb-logo" aria-label="All projects" onClick={() => navigate('/projects')}>
          <BrandMark size={24} />
        </button>
        <span className="tb-crumb-sep">/</span>
        <button type="button" className="tb-crumb tb-crumb-link" onClick={() => navigate('/projects')}>
          {workspaceLabel || workspace}
        </button>
        {badge && <span className={`tb-tier tb-tier--${badge.kind}`}>{badge.label}</span>}

        {project && (
        <>
        <span className="tb-crumb-sep">/</span>

        <div className="tb-switch" ref={switchRef}>
          <button
            type="button"
            className={'tb-switch-btn' + (switchOpen ? ' is-open' : '')}
            onClick={() => setSwitchOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={switchOpen}
          >
            <span className="tb-crumb is-here">{project}</span>
            <ChevronIcon />
          </button>

          {switchOpen && (
            <div className="tb-switch-menu" role="menu">
              {projects.length > 6 && (
                <div className="tb-switch-search">
                  <input
                    autoFocus
                    placeholder="Find project…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              )}
              <div className="tb-switch-list">
                {filtered.map((p) => {
                  const active = p.slug === slug || p.id === slug;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={'tb-switch-item' + (active ? ' is-active' : '')}
                      onClick={() => {
                        setSwitchOpen(false);
                        navigate(`/projects/${p.slug ?? p.id}`);
                      }}
                    >
                      <span className="tb-switch-mark">
                        <CubeMini />
                      </span>
                      <span className="tb-switch-name">{p.name}</span>
                      {active && <CheckIcon />}
                    </button>
                  );
                })}
                {filtered.length === 0 && <div className="tb-switch-empty">No projects</div>}
              </div>
              <button
                type="button"
                className="tb-switch-foot"
                onClick={() => {
                  setSwitchOpen(false);
                  navigate('/projects');
                }}
              >
                View all projects
              </button>
            </div>
          )}
        </div>

        <ConnectionChip slug={slug} />
        </>
        )}
      </div>

      <div className="tb-right">
        <span className="ph-search-pill" role="button" tabIndex={0}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Search…
          <span className="ph-kbd">⌘K</span>
        </span>
        <button className="tb-icon-btn" aria-label="Help" type="button" disabled>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M6.3 6.2c.2-1 1-1.7 2-1.7 1.1 0 1.9.7 1.9 1.7 0 .9-.7 1.3-1.4 1.7-.5.3-.8.7-.8 1.3v.4"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
          </svg>
        </button>
        <div className="tb-avatar-wrap">
          <button
            className={'tb-avatar' + (menuOpen ? ' is-open' : '')}
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            type="button"
          >
            {initials}
          </button>
          {menuOpen && <AccountMenu onClose={() => setMenuOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="tb-chev-ic" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="check" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CubeMini() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 1.6 L15.4 5 L15.4 13 L9 16.4 L2.6 13 L2.6 5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.6 5 L9 8.4 L15.4 5 M9 8.4 L9 16.4" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.55" strokeLinejoin="round" />
    </svg>
  );
}
