import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjects } from '../hooks/useProjects';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { ErrorState, EmptyState } from '../components/StateViews';
import { Skel, SkelStatus } from '../components/Skeleton';
import { api } from '../api/client';
import { prefetchProjectData } from '../lib/prefetch';
import type { Project } from '../api/types';

/* ─────────────────────────────────────────────────────────────
   Icons
   ─────────────────────────────────────────────────────────── */

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

/* Client-side project prefs (pin + custom order) — the API has no order/pin
   field yet, so these persist per-browser in localStorage. */
const PIN_KEY = 'veralith.projectPins';
const ORDER_KEY = 'veralith.projectOrder';
function readIds(key: string): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function writeIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/* ─────────────────────────────────────────────────────────────
   Page
   ─────────────────────────────────────────────────────────── */

export default function ProjectsHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const projectsQuery = useProjects();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [pinned, setPinned] = useState<string[]>(() => readIds(PIN_KEY));
  const [order, setOrder] = useState<string[]>(() => readIds(ORDER_KEY));
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => writeIds(PIN_KEY, pinned), [pinned]);
  useEffect(() => writeIds(ORDER_KEY, order), [order]);

  const projects = projectsQuery.data?.projects ?? [];

  // Reconcile the saved order with the live project list: keep saved positions,
  // append newly-created projects (most recent first), drop deleted ones.
  const orderedIds = useMemo(() => {
    const existing = order.filter((id) => projects.some((p) => p.id === id));
    const known = new Set(existing);
    const fresh = [...projects]
      .filter((p) => !known.has(p.id))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((p) => p.id);
    return [...existing, ...fresh];
  }, [order, projects]);

  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);

  const visibleProjects = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p] as const));
    // pinned first, then saved custom order within each group
    const ranked = [...orderedIds].sort((a, b) => {
      const ap = pinnedSet.has(a) ? 0 : 1;
      const bp = pinnedSet.has(b) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return orderedIds.indexOf(a) - orderedIds.indexOf(b);
    });
    let out = ranked.map((id) => byId.get(id)).filter((p): p is Project => Boolean(p));
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
    return out;
  }, [orderedIds, pinnedSet, projects, search]);

  function togglePin(id: string) {
    setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Drag-to-reorder (disabled while searching, since the list is filtered).
  function reorder(targetId: string) {
    if (!dragId || dragId === targetId || search.trim()) {
      setDragId(null);
      return;
    }
    const ids = visibleProjects.map((p) => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setOrder(ids);
    setDragId(null);
  }

  const isLoading = projectsQuery.isLoading;
  const isError = projectsQuery.isError;
  // True-empty: a successful fetch with no projects at all (distinct from a
  // search that filtered everything out — that keeps the normal grid).
  const isEmpty = !isLoading && !isError && projects.length === 0;

  return (
    <ProjectShell variant="workspace" active="projects">
      <div className="ph-main">
        <div className="ph-head">
          <h1 className="ph-title">Projects</h1>
        </div>

        {isLoading ? (
          <ProjectsHomeSkeleton />
        ) : isError ? (
          <ErrorState
            message={(projectsQuery.error as Error)?.message}
            onRetry={() => projectsQuery.refetch()}
          />
        ) : isEmpty ? (
          <EmptyState
            title="No projects yet"
            sub="Create your first project to start sending traces and running judges behind one API key."
            action={
              <button type="button" className="ph-btn-primary" onClick={() => setCreating(true)}>
                <PlusIcon size={15} />
                New project
              </button>
            }
          />
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
            </div>

            <div className="ph-grid">
              {visibleProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={() => navigate(`/projects/${p.slug ?? p.id}`)}
                  onPrefetch={() => prefetchProjectData(qc, p.slug ?? p.id, p.id)}
                  pinned={pinnedSet.has(p.id)}
                  onTogglePin={() => togglePin(p.id)}
                  draggable={!search.trim()}
                  dragging={dragId === p.id}
                  onDragStart={() => setDragId(p.id)}
                  onDragEnd={() => setDragId(null)}
                  onDropCard={() => reorder(p.id)}
                />
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

      {creating && <CreateProjectModal onClose={() => setCreating(false)} />}
    </ProjectShell>
  );
}

/* ─────────────────────────────────────────────────────────────
   Loading skeleton — mirrors the toolbar + project-card grid so the
   swap to real content is shift-free (same wrapper/grid/card classes,
   shimmer blocks where text + stats land).
   ─────────────────────────────────────────────────────────── */

function ProjectsHomeSkeleton() {
  return (
    <>
      <SkelStatus label="Loading projects…" />
      <div className="ph-toolbar">
        <div className="ph-field">
          <Skel w={210} h={34} r={8} />
        </div>
      </div>

      <div className="ph-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="ph-card" key={i} aria-hidden="true">
            <div className="ph-card-top">
              <Skel w={34} h={34} r={9} />
              <Skel w={70} h={18} r={999} style={{ marginLeft: 'auto' }} />
            </div>
            <Skel w="55%" h={15} r={6} />
            <Skel w="40%" h={11} r={6} style={{ marginTop: 4 }} />
            <div className="ph-card-foot">
              <Skel w={90} h={12} r={6} />
            </div>
          </div>
        ))}
      </div>
    </>
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

function ProjectCard({
  project,
  onOpen,
  onPrefetch,
  pinned,
  onTogglePin,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onDropCard,
}: {
  project: Project;
  onOpen: () => void;
  onPrefetch: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropCard: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Warm this project's data on first intent (hover/focus/press) so the project
  // pages paint instantly. Guarded so we only kick off the prefetch once.
  const prefetchedRef = useRef(false);
  const warm = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    onPrefetch();
  };
  const { name, trace_count } = project;
  // env + key-prefix are not yet exposed on the Project shape (see
  // BACKEND_GAPS.md). Show neutral placeholders until they land.
  const keyHint = (project.slug ?? '').slice(0, 14);
  const env = 'production';
  const live = trace_count > 0 ? 'live' : 'grey';

  return (
    <div
      ref={cardRef}
      className={'ph-card' + (pinned ? ' is-pinned' : '') + (dragging ? ' is-dragging' : '')}
      role="button"
      tabIndex={0}
      onMouseEnter={warm}
      onFocus={warm}
      onPointerDown={warm}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropCard();
      }}
    >
      <div className="ph-card-top">
        <span className="ph-card-mark">
          <CubeIcon />
        </span>
        <span className="ph-card-env">{env}</span>
        {draggable && (
          <span
            className="ph-card-grip"
            role="button"
            aria-label="Drag to reorder"
            draggable
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              const node = cardRef.current;
              if (node) {
                const r = node.getBoundingClientRect();
                // drag the whole card image, anchored under the cursor
                e.dataTransfer.setDragImage(node, e.clientX - r.left, e.clientY - r.top);
              }
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', project.id);
              onDragStart();
            }}
            onDragEnd={onDragEnd}
          >
            <GripIcon />
          </span>
        )}
        <button
          type="button"
          className="ph-card-pin"
          aria-label={pinned ? 'Unpin project' : 'Pin project'}
          aria-pressed={pinned}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
        >
          <PinIcon filled={pinned} />
        </button>
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
    </div>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3.5h6l-1.1 6.2 3.1 3.1v1.7H7v-1.7l3.1-3.1L9 3.5z" />
      <line x1="12" y1="14.5" x2="12" y2="20.5" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="3.5" r="1.1" />
      <circle cx="10" cy="3.5" r="1.1" />
      <circle cx="6" cy="8" r="1.1" />
      <circle cx="10" cy="8" r="1.1" />
      <circle cx="6" cy="12.5" r="1.1" />
      <circle cx="10" cy="12.5" r="1.1" />
    </svg>
  );
}
