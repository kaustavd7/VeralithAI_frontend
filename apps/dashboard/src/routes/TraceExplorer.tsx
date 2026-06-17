import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { EmptyState, ErrorState } from '../components/StateViews';
import { useProjects } from '../hooks/useProjects';
import { useStats, useTraces } from '../hooks/useOverviewData';
import type { FailureCell, TraceListItem } from '../api/types';
import { traceDetailPath } from '../lib/nav';

/* ─────────────────────────────────────────────────────────────
   Cell metadata
   ─────────────────────────────────────────────────────────── */

const CELLS: { id: FailureCell; label: string; color: string }[] = [
  { id: 'incomplete_ungrounded', label: 'incomplete · ungrounded', color: 'var(--cell-iu)' },
  { id: 'complete_ungrounded',   label: 'complete · ungrounded',   color: 'var(--cell-cu)' },
  { id: 'incomplete_grounded',   label: 'incomplete · grounded',   color: 'var(--cell-ig)' },
  { id: 'extra_ungrounded',      label: 'extra · ungrounded',      color: 'var(--cell-eu)' },
  { id: 'extra_grounded',        label: 'extra · grounded',        color: 'var(--cell-eg)' },
  { id: 'complete_grounded',     label: 'complete · grounded',     color: 'var(--cell-cg)' },
];

const CELL_BY_ID: Record<FailureCell, (typeof CELLS)[number]> = Object.fromEntries(
  CELLS.map((c) => [c.id, c]),
) as Record<FailureCell, (typeof CELLS)[number]>;

/* ─────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────── */

type TimeWindow = '1h' | '24h' | '7d' | '30d';
type SortKey =
  | 'newest'
  | 'oldest'
  | 'sufficiency_asc'
  | 'sufficiency_desc'
  | 'faithfulness_asc'
  | 'faithfulness_desc';

function sinceFor(win: TimeWindow): string {
  const ms = win === '1h' ? 3_600_000 : win === '24h' ? 86_400_000 : win === '7d' ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function severityAttr(s: number | null | undefined): 'iu' | 'ig' | undefined {
  if (s == null) return undefined;
  if (s < 0.3) return 'iu';
  if (s < 0.6) return 'ig';
  return undefined;
}

function severityBg(s: number | null | undefined): string {
  if (s == null) return 'transparent';
  if (s < 0.3) return 'var(--cell-iu)';
  if (s < 0.6) return 'var(--cell-ig)';
  return 'transparent';
}

function meterColor(value: number): string {
  if (value < 0.3) return 'var(--cell-iu)';
  if (value < 0.6) return 'var(--cell-ig)';
  if (value < 0.8) return 'var(--accent)';
  return 'var(--cell-cg)';
}

/* ─────────────────────────────────────────────────────────────
   Filter chips
   ─────────────────────────────────────────────────────────── */

function TimeWindowChips({
  active,
  onChange,
}: {
  active: TimeWindow;
  onChange: (w: TimeWindow) => void;
}) {
  const opts: TimeWindow[] = ['1h', '24h', '7d', '30d'];
  return (
    <div className="te-chip-group">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          className={'te-chip te-chip-time' + (active === o ? ' is-active' : '')}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function CellChips({
  active,
  counts,
  onToggle,
}: {
  active: Set<FailureCell>;
  counts: Record<FailureCell, number>;
  onToggle: (id: FailureCell) => void;
}) {
  return (
    <div className="te-chip-group te-cellchips">
      {CELLS.map((c) => {
        const on = active.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={'te-chip te-chip-cell' + (on ? ' is-active' : '')}
            onClick={() => onToggle(c.id)}
            title={c.label}
          >
            <span className="te-chip-sw" style={{ background: c.color }} />
            <span className="te-chip-label">{c.label}</span>
            <span className="te-chip-count po-mono">{counts[c.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Sort dropdown
   ─────────────────────────────────────────────────────────── */

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'newest' },
  { id: 'oldest', label: 'oldest' },
  { id: 'sufficiency_asc', label: 'sufficiency ↑' },
  { id: 'sufficiency_desc', label: 'sufficiency ↓' },
  { id: 'faithfulness_asc', label: 'faithfulness ↑' },
  { id: 'faithfulness_desc', label: 'faithfulness ↓' },
];

function SortPill({ sort, onChange }: { sort: SortKey; onChange: (s: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const label = SORT_OPTIONS.find((o) => o.id === sort)?.label ?? 'newest';
  return (
    <div className="te-sort" style={{ position: 'relative' }}>
      <span className="te-sort-label">sort</span>
      <button type="button" className="te-sort-pill" onClick={() => setOpen((o) => !o)}>
        <span className="po-mono">{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M2 4l3 3 3-3" stroke="currentColor" fill="none" strokeWidth="1.3" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="te-sort-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--po-panel)',
            border: '1px solid var(--po-line-strong)',
            borderRadius: 'var(--po-radius-sm)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 160,
            zIndex: 20,
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className="am-item"
              role="menuitemradio"
              aria-checked={sort === o.id}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              style={{ borderRadius: 5, padding: '6px 10px', fontSize: 12 }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MeterBar
   ─────────────────────────────────────────────────────────── */

function MeterBar({ value }: { value: number | null | undefined }) {
  const v = value ?? 0;
  return (
    <div className="te-meter">
      <span className="te-meter-val po-mono">{value == null ? '—' : v.toFixed(2)}</span>
      <div className="te-meter-track">
        <div
          className="te-meter-fill"
          style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: meterColor(v) }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CSV export
   ─────────────────────────────────────────────────────────── */

function exportCsv(rows: TraceListItem[], filename: string) {
  const header = ['id', 'created_at', 'status', 'failure_cell', 'sufficiency', 'faithfulness', 'cost_usd', 'query'];
  const escape = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.id,
      r.created_at,
      r.status,
      r.failure_cell ?? '',
      r.sufficiency_fraction ?? '',
      r.faithfulness_fraction ?? '',
      r.cost_usd ?? '',
      r.query,
    ]
      .map(escape)
      .join(','),
  );
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────────────
   Page
   ─────────────────────────────────────────────────────────── */

const PAGE_SIZE = 25;

export default function TraceExplorer() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const projects = useProjects();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // '/' focuses the search box (unless the user is already typing in a field).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const project = useMemo(
    () => projects.data?.projects.find((p) => p.slug === slug || p.id === slug),
    [projects.data, slug],
  );

  // Seed filters from the URL (e.g. the Today "active failures" alert deep-links here).
  const [searchParams] = useSearchParams();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    const w = searchParams.get('window');
    return w === '1h' || w === '24h' || w === '7d' || w === '30d' ? w : '24h';
  });
  const [activeCells, setActiveCells] = useState<Set<FailureCell>>(() => {
    const raw = searchParams.get('cells');
    if (!raw) return new Set();
    const valid = new Set<string>(CELLS.map((c) => c.id));
    return new Set(raw.split(',').filter((id) => valid.has(id)) as FailureCell[]);
  });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>(() => {
    const s = searchParams.get('sort');
    const ok = ['newest', 'oldest', 'sufficiency_asc', 'sufficiency_desc', 'faithfulness_asc', 'faithfulness_desc'];
    return ok.includes(s ?? '') ? (s as SortKey) : 'newest';
  });
  const [page, setPage] = useState(0);

  const since = useMemo(() => sinceFor(timeWindow), [timeWindow]);
  const cellsArg = useMemo(() => (activeCells.size ? Array.from(activeCells) : undefined), [activeCells]);
  const serverSort = sort === 'oldest' ? 'oldest' : 'newest';

  const stats = useStats(slug);
  const traces = useTraces(slug, {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    since,
    cells: cellsArg,
    sort: serverSort,
  });

  // Client-side search + sort applied to the loaded page only.
  // Free-text search and sort-by-sufficiency are not yet in the v1 contract
  // (see BACKEND_GAPS.md). The header surfaces this scope limit.
  const rows = useMemo(() => {
    const list = traces.data?.traces ?? [];
    let out = list;
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((t) => {
        if (t.query.toLowerCase().includes(q)) return true;
        if (t.response_preview.toLowerCase().includes(q)) return true;
        if (String(t.id).includes(q)) return true;
        return false;
      });
    }
    // Always float evaluating rows to the top regardless of sort.
    const evalRows = out.filter((t) => t.status === 'evaluating');
    let scored = out.filter((t) => t.status !== 'evaluating');
    if (sort === 'sufficiency_asc') {
      scored = [...scored].sort((a, b) => (a.sufficiency_fraction ?? 1) - (b.sufficiency_fraction ?? 1));
    } else if (sort === 'sufficiency_desc') {
      scored = [...scored].sort((a, b) => (b.sufficiency_fraction ?? 0) - (a.sufficiency_fraction ?? 0));
    } else if (sort === 'faithfulness_asc') {
      scored = [...scored].sort((a, b) => (a.faithfulness_fraction ?? 1) - (b.faithfulness_fraction ?? 1));
    } else if (sort === 'faithfulness_desc') {
      scored = [...scored].sort((a, b) => (b.faithfulness_fraction ?? 0) - (a.faithfulness_fraction ?? 0));
    }
    return [...evalRows, ...scored];
  }, [traces.data, search, sort]);

  const total = traces.data?.total ?? 0;
  const offset = page * PAGE_SIZE;
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + rows.length, total);
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const counts: Record<FailureCell, number> = useMemo(() => {
    const base = {
      complete_grounded: 0,
      complete_ungrounded: 0,
      incomplete_grounded: 0,
      incomplete_ungrounded: 0,
      extra_grounded: 0,
      extra_ungrounded: 0,
    };
    if (stats.data?.by_cell) Object.assign(base, stats.data.by_cell);
    return base;
  }, [stats.data]);

  function toggleCell(id: FailureCell) {
    setActiveCells((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPage(0);
  }

  function resetFilters() {
    setSearch('');
    setActiveCells(new Set());
    setTimeWindow('24h');
    setSort('newest');
    setPage(0);
  }

  const isEmpty = !traces.isLoading && rows.length === 0;
  // A genuinely empty project (no traces ever ingested) shows the "connect your
  // SDK" empty state. The project-wide stats total is window-independent, so it
  // distinguishes a brand-new project from a filter/window that simply matched
  // nothing. If we can't yet read stats, fall back to "no filters active".
  const hasActiveFilters = activeCells.size > 0 || search.trim() !== '';
  const projectHasNoTraces =
    stats.data != null ? stats.data.total_traces === 0 : !hasActiveFilters;
  const isEmptyProject = isEmpty && projectHasNoTraces;
  const isEmptyAfterFilters = isEmpty && !isEmptyProject;
  const sortLabel =
    sort === 'oldest' ? 'oldest' :
    sort === 'sufficiency_asc' ? 'sufficiency ↑' :
    sort === 'sufficiency_desc' ? 'sufficiency ↓' :
    sort === 'faithfulness_asc' ? 'faithfulness ↑' :
    sort === 'faithfulness_desc' ? 'faithfulness ↓' :
    'newest';
  const projectName = project?.name ?? slug;

  return (
    <ProjectShell slug={slug} active="traces" project={projectName}>
      <div className="te-page">
        <header className="te-head">
          <div>
            <h1 className="te-title">Traces</h1>
            <div className="te-sub">
              <span className="po-mono">{total.toLocaleString()}</span> traces in last {timeWindow} ·{' '}
              sorted <span className="po-mono">{sortLabel}</span>
              {sort === 'sufficiency_asc' && (
                <span> · client-side over current page</span>
              )}
            </div>
          </div>
          <div className="te-head-r">
            <button
              type="button"
              className="po-btn po-btn-ghost"
              onClick={() => exportCsv(rows, `traces-${slug}-${timeWindow}.csv`)}
              disabled={rows.length === 0}
              title="Exports the loaded page (server-side bulk export coming in a future contract version)."
            >
              Export CSV
            </button>
          </div>
        </header>

        <div className="te-filters">
          <div className="te-filter-row">
            <TimeWindowChips
              active={timeWindow}
              onChange={(w) => {
                setTimeWindow(w);
                setPage(0);
              }}
            />
            <div className="te-search">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search query or trace id (current page)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="te-search-kbd po-mono">/</span>
            </div>
          </div>
          <div className="te-filter-row">
            <CellChips active={activeCells} counts={counts} onToggle={toggleCell} />
            <SortPill sort={sort} onChange={setSort} />
          </div>
        </div>

        {traces.isError || stats.isError ? (
          <ErrorState
            message={
              (traces.error instanceof Error ? traces.error.message : null) ??
              (stats.error instanceof Error ? stats.error.message : null) ??
              'Could not load traces. Please try again.'
            }
            onRetry={() => {
              if (traces.isError) traces.refetch();
              if (stats.isError) stats.refetch();
            }}
          />
        ) : traces.isLoading ? (
          <div style={{ padding: '40px 0', color: 'var(--po-fg-3)' }}>Loading traces…</div>
        ) : isEmptyProject ? (
          <EmptyState
            title="No traces yet"
            sub="Connect your SDK and send your first trace — they'll appear here in real time."
            action={
              <Link
                to={`/projects/${slug}`}
                className="po-btn"
                style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                Connect your SDK
              </Link>
            }
          />
        ) : isEmptyAfterFilters ? (
          <div className="te-empty">
            <div className="te-empty-mark">
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="te-empty-title">No traces match current filters</div>
            <div className="te-empty-sub">
              Try widening the time window, clearing the search box, or removing failure-cell filters.
            </div>
            <button type="button" className="po-btn te-reset-btn" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <div className="te-table">
              <div className="te-tbody">
                {rows.map((r) => {
                  const cell = r.failure_cell ? CELL_BY_ID[r.failure_cell] : null;
                  const evaluating = r.status === 'evaluating';
                  return (
                    <div
                      key={r.id}
                      className={'te-row' + (evaluating ? ' is-evaluating' : '')}
                      data-sev={severityAttr(r.sufficiency_fraction)}
                      onClick={() => navigate(traceDetailPath(slug, r.id))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(traceDetailPath(slug, r.id));
                        }
                      }}
                      role="link"
                      tabIndex={0}
                      title={r.query}
                    >
                      <div className="te-td te-col-sev">
                        <span
                          className={'te-sev' + (evaluating ? ' is-evaluating' : '')}
                          style={evaluating ? undefined : { background: severityBg(r.sufficiency_fraction) }}
                        />
                      </div>
                      <div className="te-td te-col-q">
                        <span className="te-q-id po-mono" title={r.id}>#{r.id.slice(0, 8)}</span>
                        <span className="te-q-text">{r.query}</span>
                      </div>
                      <div className="te-td te-col-cell">
                        {evaluating ? (
                          <span className="te-eval-pill">
                            <span className="te-eval-dot" />evaluating
                          </span>
                        ) : cell ? (
                          <button
                            type="button"
                            className={'te-cell-pill' + (activeCells.has(cell.id) ? ' is-active' : '')}
                            style={{
                              ['--c' as keyof CSSProperties]: cell.color,
                              cursor: 'pointer',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              margin: 0,
                              textAlign: 'inherit',
                            } as CSSProperties}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCell(cell.id);
                            }}
                            aria-pressed={activeCells.has(cell.id)}
                            title={`Filter by ${cell.label}`}
                          >
                            <span className="te-cell-label">{cell.label}</span>
                          </button>
                        ) : (
                          <span className="po-mono" style={{ color: 'var(--po-fg-4)', fontSize: 12 }}>—</span>
                        )}
                      </div>
                      <div className="te-td te-col-s">
                        {evaluating ? <span className="te-shimmer" /> : <MeterBar value={r.sufficiency_fraction} />}
                      </div>
                      <div className="te-td te-col-f">
                        {evaluating ? <span className="te-shimmer" /> : <MeterBar value={r.faithfulness_fraction} />}
                      </div>
                      <div className="te-td te-col-time po-mono">{relativeTime(r.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="te-pager">
              <div className="te-pager-l po-mono">
                showing <b>{showingFrom}–{showingTo}</b> of <b>{total.toLocaleString()}</b>
              </div>
              <div className="te-pager-r">
                <button
                  type="button"
                  className="te-page-btn"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  ‹
                </button>
                <span className="te-page-btn is-active">{page + 1}</span>
                <span className="po-mono" style={{ color: 'var(--po-fg-4)', fontSize: 11, padding: '0 4px' }}>
                  / {lastPage + 1}
                </span>
                <button
                  type="button"
                  className="te-page-btn"
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </ProjectShell>
  );
}
