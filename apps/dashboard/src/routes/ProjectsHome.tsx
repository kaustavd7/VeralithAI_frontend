import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import { AccountMenu } from '../components/projectShell/AccountMenu';
import { api } from '../api/client';
import '../styles/project-shell.css';
import '../styles/project-page.css';
import type { Project } from '../api/types';

/* ─────────────────────────────────────────────────────────────
   Icons
   ─────────────────────────────────────────────────────────── */

function BrandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22">
      <path
        d="M4 13.5 L7.5 6.5 L13 5 L18.5 9.5 L18 15 L11.5 19 L5 17.5 Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 6.5 L11 11 L18.5 9.5 M11 11 L11.5 19 M11 11 L5 17.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.55"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CubeIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M9 1.6 L15.4 5 L15.4 13 L9 16.4 L2.6 13 L2.6 5 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M2.6 5 L9 8.4 L15.4 5 M9 8.4 L9 16.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeOpacity="0.55"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
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
  );
}

function PlusIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────── */

function workspaceInitials(name: string): string {
  const parts = name.split(/[\s'`]+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function userInitials(displayName: string, email: string | undefined): string {
  const src = displayName || email || '';
  return workspaceInitials(src);
}

type SortKey = 'active' | 'name' | 'traces';

/* ─────────────────────────────────────────────────────────────
   Page
   ─────────────────────────────────────────────────────────── */

export default function ProjectsHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const projectsQuery = useProjects();
  const [acctOpen, setAcctOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('active');
  const [creating, setCreating] = useState(false);

  const displayName = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    if (full) return full;
    return user?.email?.split('@')[0] ?? '';
  }, [user]);

  const workspaceName = displayName ? `${displayName}'s workspace` : 'workspace';

  const projects = projectsQuery.data?.projects ?? [];
  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = projects;
    if (q) out = out.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
    out = [...out].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'traces') return (b.trace_count ?? 0) - (a.trace_count ?? 0);
      // 'active' — most recently created first as a proxy until last_trace_at lands
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
    return out;
  }, [projects, search, sort]);

  const isLoading = projectsQuery.isLoading;
  const isEmpty = !isLoading && projects.length === 0;

  return (
    <div className="ph">
      <header className="ph-top">
        <span className="ph-brand">
          <span className="ph-brand-mark">
            <BrandIcon />
          </span>
          <span className="ph-brand-name">VeralithAI</span>
        </span>
        <span className="ph-crumb-sep">/</span>
        <span className="ph-crumb">
          <span className="ph-ws-mark">{workspaceInitials(workspaceName)}</span>
          {workspaceName}
        </span>

        <div className="ph-top-right">
          <span className="ph-search-pill" role="button" tabIndex={0}>
            <SearchIcon />
            Search…
            <span className="ph-kbd">⌘K</span>
          </span>
          <button type="button" className="ph-icon-btn" aria-label="Help">
            <HelpIcon />
          </button>
          <span className="ph-avatar-wrap">
            <button
              type="button"
              className="ph-avatar tb-avatar"
              aria-haspopup="menu"
              aria-expanded={acctOpen}
              onClick={() => setAcctOpen((v) => !v)}
            >
              {userInitials(displayName, user?.email)}
            </button>
            {acctOpen && <AccountMenu onClose={() => setAcctOpen(false)} />}
          </span>
        </div>
      </header>

      <div className="ph-scroll">
        <div className="ph-main">
          <div className="ph-head">
            <h1 className="ph-title">Your projects</h1>
            <div className="ph-sub">
              {isLoading
                ? 'Loading…'
                : isEmpty
                  ? `${workspaceName} · Free plan`
                  : `${projects.length} project${projects.length === 1 ? '' : 's'} · ${workspaceName} · Free plan`}
            </div>
          </div>

          {isEmpty ? (
            <div className="ph-empty">
              <span className="ph-empty-mark">
                <CubeIcon size={24} />
              </span>
              <div className="ph-empty-title">No projects yet</div>
              <div className="ph-empty-sub">
                Create your first project to get an API key and start sending traces from your LLM app.
              </div>
              <button type="button" className="ph-new" onClick={() => setCreating(true)}>
                <PlusIcon />
                New project
              </button>
            </div>
          ) : (
            <>
              <div className="ph-toolbar">
                <div className="ph-field">
                  <SearchIcon size={14} />
                  <input
                    className="ph-input"
                    placeholder="Search projects…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="ph-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  <option value="active">Last active</option>
                  <option value="name">Name</option>
                  <option value="traces">Trace volume</option>
                </select>
                <button type="button" className="ph-new" onClick={() => setCreating(true)}>
                  <PlusIcon />
                  New project
                </button>
              </div>

              <div className="ph-grid">
                {visibleProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} onOpen={() => navigate(`/projects/${p.slug ?? p.id}`)} />
                ))}
                <button
                  type="button"
                  className="ph-card ph-card-ghost"
                  onClick={() => setCreating(true)}
                >
                  <PlusIcon size={16} />
                  New project
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {creating && <CreateProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Create-project modal — name + region. Region is cosmetic (no
   backend param yet); on Create we provision the project plus a
   default API key so it can receive traces immediately, then route
   to the new project's overview. The guided one-time full-key
   reveal still lives in /onboarding.
   ─────────────────────────────────────────────────────────── */

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('us-east');

  const create = useMutation({
    mutationFn: async (projName: string) => {
      const { project } = await api.createProject({ name: projName });
      // Provision a default key so the new project can ingest right away.
      try {
        await api.createApiKey(project.id, { name: 'default' });
      } catch {
        /* non-fatal — the key can be issued later */
      }
      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
      navigate(`/projects/${project.slug ?? project.id}`);
    },
  });

  const trimmed = name.trim();
  const regions: [string, string][] = [
    ['us-east', 'US East'],
    ['eu-west', 'EU West'],
    ['ap-south', 'AP South'],
  ];

  return (
    <div
      className="ph-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ph-modal" role="dialog" aria-modal="true">
        <div className="ph-modal-head">
          <div className="ph-modal-title">Create a new project</div>
          <div className="ph-modal-sub">A project groups traces, judges and analytics behind one API key.</div>
        </div>
        <div className="ph-modal-body">
          <div className="ph-form-row">
            <label className="ph-form-label" htmlFor="ph-proj-name">Project name</label>
            <input
              id="ph-proj-name"
              className="ph-form-control"
              placeholder="e.g. billing-rag"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && trimmed && !create.isPending) create.mutate(trimmed);
              }}
            />
            <span className="ph-form-hint">Lowercase, used in your project URL and key prefix.</span>
          </div>
          <div className="ph-form-row">
            <label className="ph-form-label">Region</label>
            <div className="ph-seg">
              {regions.map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className={'ph-seg-opt' + (region === id ? ' is-active' : '')}
                  onClick={() => setRegion(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {create.isError && <span className="ph-form-err">Couldn’t create the project. Please try again.</span>}
        </div>
        <div className="ph-modal-foot">
          <button type="button" className="ph-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="ph-btn-primary"
            disabled={!trimmed || create.isPending}
            onClick={() => create.mutate(trimmed)}
          >
            {create.isPending ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Project card
   ─────────────────────────────────────────────────────────── */

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const { name, trace_count } = project;
  // env + key-prefix are not yet exposed on the Project shape (see
  // BACKEND_GAPS.md). Show neutral placeholders until they land.
  const keyHint = (project.slug ?? '').slice(0, 14);
  const env = 'production';
  const live = trace_count > 0 ? 'live' : 'grey';

  return (
    <button type="button" className="ph-card" onClick={onOpen}>
      <div className="ph-card-top">
        <span className="ph-card-mark">
          <CubeIcon />
        </span>
        <span className="ph-card-env">{env}</span>
      </div>
      <div className="ph-card-name">{name}</div>
      <div className="ph-card-key">{keyHint || '—'}</div>
      <div className="ph-card-foot">
        {trace_count > 0 ? (
          <>
            <span className="ph-card-stat">
              <b>{trace_count.toLocaleString()}</b> traces
            </span>
            <span className="ph-card-foot-sep" />
            <span className="ph-card-live">
              <span className={`po-dot po-dot-${live}`} />
              active
            </span>
          </>
        ) : (
          <span className="ph-card-live">
            <span className="po-dot po-dot-grey" />
            no traces yet
          </span>
        )}
      </div>
      <span className="ph-card-arrow">
        <ArrowIcon />
      </span>
    </button>
  );
}
