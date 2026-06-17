import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import { LoadingState, ErrorState } from '../components/StateViews';
import { traceDetailPath, healsPath } from '../lib/nav';
import '../styles/project-shell.css';
import '../styles/project-page.css';
import type {
  HealCardDetail,
  HealCardSummary,
  HealStatus,
  ProposedFix,
  HealEvidenceTrace,
} from '../api/types';

/* ─────────────────────────────────────────────────────────────
   Status metadata
   ─────────────────────────────────────────────────────────── */

type StatusMeta = {
  label: string;
  phrase: string | null;
  color: string;
  pulse?: boolean;
};

const STATUS_META: Record<HealStatus, StatusMeta> = {
  open:           { label: 'Open',           phrase: 'Awaiting decision',         color: 'var(--accent)' },
  in_progress:    { label: 'In progress',    phrase: 'Claude Code is working…',   color: 'var(--cell-ig)', pulse: true },
  pr_raised:      { label: 'PR raised',      phrase: 'PR raised — review needed', color: 'var(--cell-cg)' },
  resolved:       { label: 'Resolved',       phrase: 'Fixed — PR accepted',       color: 'var(--cell-cg)' },
  failed:         { label: 'Failed',         phrase: null,                        color: 'var(--cell-cu)' },
  manually_fixed: { label: 'Fixed manually', phrase: 'Marked fixed manually',     color: 'var(--po-grey)' },
  wont_fix:       { label: "Won't fix",      phrase: 'Dismissed',                 color: 'var(--po-grey)' },
  superseded:     { label: 'Superseded',     phrase: 'Superseded by newer card',  color: 'var(--po-grey)' },
};

const TERMINAL: HealStatus[] = ['resolved', 'manually_fixed', 'wont_fix', 'superseded'];
const STATUS_RANK: Partial<Record<HealStatus, number>> = {
  open: 0, pr_raised: 1, in_progress: 2, failed: 3,
};

const FILTERS = [
  { id: 'all',         label: 'All' },
  { id: 'open',        label: 'Open' },
  { id: 'pr_raised',   label: 'PR Raised' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'failed',      label: 'Failed' },
  { id: 'terminal',    label: 'Terminal' },
] as const;
type FilterId = (typeof FILTERS)[number]['id'];

/* ─────────────────────────────────────────────────────────────
   Tiny SVGs
   ─────────────────────────────────────────────────────────── */

function Caret({ open }: { open: boolean }) {
  return (
    <svg className={'he-caret' + (open ? ' is-open' : '')} width="9" height="9" viewBox="0 0 10 10" fill="none">
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ExtLink() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 4, verticalAlign: '-1px' }}>
      <path d="M4 2h6v6M10 2L5 7M9 7v3H2V3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Small components
   ─────────────────────────────────────────────────────────── */

function StatusBadge({ status, size = 'sm' }: { status: HealStatus; size?: 'sm' | 'lg' }) {
  const m = STATUS_META[status] ?? { label: status, phrase: null, color: 'var(--po-grey)' };
  return (
    <span className={`he-badge he-badge-${size}`} style={{ '--c': m.color } as React.CSSProperties}>
      <span className={'he-badge-dot' + (m.pulse ? ' is-pulse' : '')} />
      {m.label}
    </span>
  );
}

function ConfidencePill({ level }: { level: ProposedFix['classification_confidence'] }) {
  const c = level === 'high' ? 'var(--cell-cg)' : level === 'medium' ? 'var(--cell-ig)' : 'var(--cell-cu)';
  return <span className="he-conf" style={{ '--c': c } as React.CSSProperties}>{level}</span>;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function shortId(id: string): string {
  return id.split('-')[0]?.slice(0, 8) ?? id.slice(0, 8);
}

/* ─────────────────────────────────────────────────────────────
   Queue row
   ─────────────────────────────────────────────────────────── */

function QueueRow({
  card, selected, flash, onClick,
}: {
  card: HealCardSummary;
  selected: boolean;
  flash: boolean;
  onClick: () => void;
}) {
  const m = STATUS_META[card.status] ?? { label: card.status, phrase: null, color: 'var(--po-grey)' };
  return (
    <button
      className={'he-card-row' + (selected ? ' is-selected' : '') + (flash ? ' is-flash' : '')}
      style={{ '--c': m.color } as React.CSSProperties}
      onClick={onClick}
    >
      <span className="he-card-stripe" />
      <div className="he-card-title">{card.title}</div>
      <div className="he-card-meta">
        <StatusBadge status={card.status} />
        <span className="he-card-traces">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 9.5h9M1.5 6h6M1.5 2.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {card.n_traces}
        </span>
        {card.pr_url && <span className="he-card-pr"><ExtLink /></span>}
        <span className="he-card-time">{relativeTime(card.last_trace_at)}</span>
      </div>
      <span className="he-card-go" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Evidence row + patch
   ─────────────────────────────────────────────────────────── */

function EvidenceRow({
  trace, defaultOpen, onOpenTrace,
}: {
  trace: HealEvidenceTrace;
  defaultOpen: boolean;
  onOpenTrace: (traceId: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // FailureCell → 2-letter abbreviation for chip
  const abbr = trace.failure_cell.split('_').map((p) => p[0]).join('') as 'cu' | 'iu' | 'ig' | 'eu' | 'eg' | 'cg';
  const cellLabels: Record<string, string> = {
    cu: 'complete · ungrounded', iu: 'incomplete · ungrounded',
    ig: 'incomplete · grounded', eu: 'extra · ungrounded',
    eg: 'extra · grounded',      cg: 'complete · grounded',
  };
  function openTrace() {
    onOpenTrace(trace.id);
  }
  return (
    <div className={'he-ev' + (open ? ' is-open' : '')}>
      <div
        className="he-ev-head"
        role="link"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        title={`Open trace ${shortId(trace.id)}`}
        onClick={openTrace}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openTrace();
          }
        }}
      >
        <button
          type="button"
          className="he-ev-toggle"
          aria-label={open ? 'Collapse trace details' : 'Expand trace details'}
          aria-expanded={open}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', color: 'inherit' }}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        >
          <Caret open={open} />
        </button>
        <span className="he-ev-id" title={trace.id}>{shortId(trace.id)}</span>
        <span className="he-cell-chip" style={{ '--c': `var(--fcell-${abbr})` } as React.CSSProperties}>
          <span className="he-cell-dot" />
          {cellLabels[abbr]}
        </span>
        <span className="he-ev-q">{trace.query}</span>
        <span className="he-card-go" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {open && (
        <div className="he-ev-body">
          <div className="he-ev-field">
            <div className="he-ev-flabel">query</div>
            <div className="he-ev-query">{trace.query}</div>
          </div>
          <div className="he-ev-field">
            <div className="he-ev-flabel">response</div>
            <div className="he-ev-resp">{trace.response}</div>
          </div>
          <div className="he-ev-foot">
            <span className="he-score"><span className="he-score-k">sufficiency</span> <b>{trace.sufficiency_score.toFixed(2)}</b></span>
            <span className="he-score"><span className="he-score-k">faithfulness</span> <b>{trace.faithfulness_score.toFixed(2)}</b></span>
          </div>
        </div>
      )}
    </div>
  );
}

function PatchBlock({ patch }: { patch: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="he-patch">
      <button className="he-patch-head" onClick={() => setOpen((o) => !o)}>
        <Caret open={open} />
        failure_patch
      </button>
      {open && (
        <pre className="he-patch-body">
          {patch.split('\n').map((ln, i) => {
            const cls = ln.startsWith('+') ? 'add' : ln.startsWith('-') ? 'del' : ln.startsWith('@@') ? 'hunk' : '';
            return <div key={i} className={'he-patch-ln he-patch-' + cls}>{ln || ' '}</div>;
          })}
        </pre>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Confirm modal
   ─────────────────────────────────────────────────────────── */

type ConfirmKind = 'decline' | 'dismiss-fixed' | 'dismiss-ignore';
const CONFIRMS: Record<ConfirmKind, { title: string; body: string; cta: string; danger: boolean }> = {
  'decline':        { title: 'Decline this PR?',          body: 'Claude Code will close the PR in your repo. The card returns to in-progress.', cta: 'Decline PR', danger: false },
  'dismiss-fixed':  { title: 'Mark as fixed manually?',   body: 'The card moves to a terminal state and won’t reopen for this pattern.',   cta: 'Mark fixed', danger: false },
  'dismiss-ignore': { title: 'Dismiss this pattern?',     body: 'Future failing traces won’t reopen this card. They may open a new card with the same pattern.', cta: 'Dismiss',    danger: true },
};

function ConfirmModal({
  kind, onConfirm, onCancel,
}: {
  kind: ConfirmKind;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const c = CONFIRMS[kind];
  return (
    <div className="he-modal-scrim" onClick={onCancel}>
      <div className="he-modal" onClick={(e) => e.stopPropagation()}>
        <div className="he-modal-title">{c.title}</div>
        <div className="he-modal-body">{c.body}</div>
        <div className="he-modal-actions">
          <button className="he-btn he-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className={'he-btn ' + (c.danger ? 'he-btn-danger' : 'he-btn-primary')}
            onClick={onConfirm}
          >{c.cta}</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Action bar
   ─────────────────────────────────────────────────────────── */

type ActionKind = 'heal' | 'accept' | 'decline' | 'retry' | 'dismiss-fixed' | 'dismiss-ignore';

function ActionBar({
  card,
  onAction,
  pendingAction,
  errorMessage,
}: {
  card: HealCardDetail;
  onAction: (a: ActionKind) => void;
  pendingAction: ActionKind | null;
  errorMessage: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const st = card.status;
  const busy = pendingAction !== null;

  // Label for an action button: a pending affordance (spinner + "…") while that
  // action is in flight, otherwise its normal label.
  const actionLabel = (a: ActionKind, label: string): React.ReactNode =>
    pendingAction === a ? <><span className="he-spinner" />…</> : label;

  const IgnoreSplit = (
    <div className="he-split">
      <button
        className="he-btn he-btn-ghost"
        disabled={busy}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {pendingAction === 'dismiss-fixed' || pendingAction === 'dismiss-ignore'
          ? <><span className="he-spinner" />…</>
          : 'Ignore'}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 5 }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menuOpen && (
        <div className="he-split-menu">
          <button onClick={() => { setMenuOpen(false); onAction('dismiss-fixed'); }}>I fixed manually</button>
          <button onClick={() => { setMenuOpen(false); onAction('dismiss-ignore'); }}>Just ignore</button>
        </div>
      )}
    </div>
  );

  let buttons: React.ReactNode = null;
  if (st === 'open') {
    buttons = <>
      <button className="he-btn he-btn-primary" disabled={busy} onClick={() => onAction('heal')}>
        {actionLabel('heal', 'Heal with Claude Code')}
      </button>
      {IgnoreSplit}
    </>;
  } else if (st === 'failed') {
    buttons = <>
      <button className="he-btn he-btn-primary" disabled={busy} onClick={() => onAction('retry')}>
        {actionLabel('retry', 'Retry')}
      </button>
      {IgnoreSplit}
    </>;
  } else if (st === 'in_progress') {
    buttons = (
      <button className="he-btn he-btn-working" disabled>
        <span className="he-spinner" />Working…
      </button>
    );
  } else if (st === 'pr_raised') {
    buttons = <>
      <button className="he-btn he-btn-good" disabled={busy} onClick={() => onAction('accept')}>
        {actionLabel('accept', 'Accept PR')}
      </button>
      <button className="he-btn he-btn-ghost" disabled={busy} onClick={() => onAction('decline')}>
        {actionLabel('decline', 'Decline')}
      </button>
      {card.pr_url && (
        <a className="he-pr-badge" href={card.pr_url} target="_blank" rel="noreferrer">
          View PR<ExtLink />
        </a>
      )}
    </>;
  } else if (st === 'resolved') {
    buttons = <>
      <span className="he-terminal-note">
        {card.pr_accepted_at ? `PR accepted ${relativeTime(card.pr_accepted_at)}` : 'PR accepted'}
      </span>
      {card.pr_url && <a className="he-pr-badge" href={card.pr_url} target="_blank" rel="noreferrer">View PR<ExtLink /></a>}
    </>;
  } else if (st === 'manually_fixed' || st === 'wont_fix') {
    const m = STATUS_META[st] ?? { label: st, phrase: null, color: 'var(--po-grey)' };
    buttons = <span className="he-terminal-note">{m.phrase} · no further action</span>;
  } else if (st === 'superseded') {
    buttons = <span className="he-terminal-note">Replaced by a newer card</span>;
  }

  const terminal = TERMINAL.includes(st);
  return (
    <div className="he-action-wrap">
      <div className="he-action-bar">{buttons}</div>
      {errorMessage && (
        <div
          className="he-action-error"
          role="alert"
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 'var(--po-radius-sm)',
            border: '1px solid color-mix(in oklab, var(--po-bad) 40%, transparent)',
            background: 'color-mix(in oklab, var(--po-bad) 10%, transparent)',
            color: 'var(--po-bad)',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flex: '0 0 auto', marginTop: 1 }} aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>Action failed: {errorMessage}</span>
        </div>
      )}
      {!terminal && (
        <div className="he-mcp-hint">
          <span className="he-mcp-ic">🤝</span>
          <span>
            <b>Heal with Claude Code</b> sends a request to your local Claude Code (configured via MCP).
            Watch this card for updates — typically 1–5 minutes.
          </span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Detail pane
   ─────────────────────────────────────────────────────────── */

function DetailPane({
  card,
  isLoading,
  isError,
  loadError,
  onRetry,
  onAction,
  onCollapse,
  pendingAction,
  actionError,
}: {
  card: HealCardDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  loadError: string | undefined;
  onRetry: () => void;
  onAction: (a: ActionKind) => void;
  onCollapse: () => void;
  pendingAction: ActionKind | null;
  actionError: string | null;
}) {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  if (isError && !card) {
    return (
      <div className="he-detail he-detail-empty">
        <ErrorState message={loadError} onRetry={onRetry} />
      </div>
    );
  }
  if (isLoading || !card) {
    return (
      <div className="he-detail he-detail-empty">
        <div className="he-placeholder">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <g transform="rotate(45 17 17)">
              <rect x="4" y="12" width="26" height="10" rx="5" stroke="var(--po-fg-4)" strokeWidth="1.6" />
              <circle cx="17" cy="17" r="3" stroke="var(--po-fg-4)" strokeWidth="1.4" />
            </g>
          </svg>
          <div className="he-placeholder-t">
            {isLoading ? 'Loading heal card…' : 'Select a heal to view details'}
          </div>
        </div>
      </div>
    );
  }
  const m = STATUS_META[card.status] ?? { label: card.status, phrase: null, color: 'var(--po-grey)' };
  const phrase = card.status === 'failed' ? card.failure_reason : m.phrase;
  return (
    <div className="he-detail">
      <div className="he-detail-head">
        <button className="he-detail-collapse" onClick={onCollapse} title="Hide detail panel">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M9.5 3l-4 5 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Hide</span>
        </button>
        <div className="he-detail-statusline">
          <StatusBadge status={card.status} size="lg" />
          <span
            className="he-phrase"
            style={{ color: card.status === 'failed' ? 'var(--cell-cu)' : 'var(--po-fg-3)' }}
          >{phrase}</span>
        </div>
        <h2 className="he-detail-title">{card.title}</h2>
        <div className="he-meta">
          <span className="he-meta-slug">{card.suggestion_slug}</span>
          <span className="he-dot-sep">·</span>
          <span>{card.n_traces} traces</span>
          <span className="he-dot-sep">·</span>
          <span>Created {relativeTime(card.created_at)}</span>
        </div>
        {card.previous_card_id && (
          <div className="he-recur">
            Previous attempt: <Link to={healsPath(slug, card.previous_card_id)}>earlier card</Link> didn’t fix it — recurred at this trace.
          </div>
        )}
      </div>

      <ActionBar
        card={card}
        onAction={onAction}
        pendingAction={pendingAction}
        errorMessage={actionError}
      />

      <div className="he-section">
        <div className="he-section-h">Suggestion</div>
        <p className="he-prose">{card.suggestion_description}</p>
      </div>

      <div className="he-section">
        <div className="he-section-h">Proposed fixes</div>
        {card.proposed_fixes && card.proposed_fixes.length > 0 ? (
          <ol className="he-fixes">
            {card.proposed_fixes.map((f, i) => (
              <li className="he-fix" key={i}>
                <span className="he-fix-num">{i + 1}</span>
                <div className="he-fix-body">
                  <div className="he-fix-titlerow">
                    <span className="he-fix-title">{f.title}</span>
                    <ConfidencePill level={f.classification_confidence} />
                  </div>
                  <p className="he-fix-text">{f.body}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="he-empty-line">No proposed fixes yet — waiting for evaluation to classify the pattern.</p>
        )}
      </div>

      <div className="he-section">
        <div className="he-section-h">
          Evidence traces <span className="he-section-count">{card.evidence_traces.length}</span>
        </div>
        <div className="he-ev-list">
          {card.evidence_traces.map((t, i) => (
            <EvidenceRow
              key={t.id}
              trace={t}
              defaultOpen={i < 3}
              onOpenTrace={(traceId) => navigate(traceDetailPath(slug, traceId))}
            />
          ))}
        </div>
      </div>

      {card.status === 'failed' && (
        <div className="he-section">
          <div className="he-section-h">Why Claude Code couldn’t fix this</div>
          {card.failure_reason && <p className="he-prose">{card.failure_reason}</p>}
          {card.failure_patch && <PatchBlock patch={card.failure_patch} />}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page — rendered inside the project shell (sidebar + topbar)
   ─────────────────────────────────────────────────────────── */

export default function Heals() {
  const { slug = '', cardId } = useParams<{ slug: string; cardId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projects = useProjects();
  const activeProject = projects.data?.projects.find((p) => p.slug === slug || p.id === slug);
  const projectName = activeProject?.name ?? slug;
  const projectId = activeProject?.id ?? null;

  const [filter, setFilter] = useState<FilterId>('all');
  const [splitPct, setSplitPct] = useState(42);
  const [detailOpen, setDetailOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const lastStatusRef = useRef<Record<string, HealStatus>>({});

  // GET /v1/heals is global across the user's projects (no projectId param),
  // so we pass the active tab as status_filter and scope to this project below.
  // 'all' / 'terminal' aren't single statuses → no server-side status_filter.
  const statusFilter: HealStatus | undefined =
    filter === 'all' || filter === 'terminal' ? undefined : filter;

  // Polling cadence per the contract: 10–15s for list.
  const listQuery = useQuery({
    queryKey: ['heals', projectId, statusFilter ?? 'all'],
    queryFn: () => api.listHeals({ status_filter: statusFilter, limit: 100 }),
    refetchInterval: 12_000,
  });

  // 5s for detail while status is non-terminal.
  const detailQuery = useQuery({
    queryKey: ['heal', cardId],
    queryFn: () => api.getHeal(cardId!),
    enabled: !!cardId,
    refetchInterval: (q) => {
      const data = q.state.data as HealCardDetail | undefined;
      if (!data) return false;
      return TERMINAL.includes(data.status) ? false : 5_000;
    },
  });

  // GET /v1/heals is global → scope to the current project client-side.
  const cards: HealCardSummary[] = useMemo(() => {
    const all = listQuery.data ?? [];
    return projectId ? all.filter((c) => c.project_id === projectId) : all;
  }, [listQuery.data, projectId]);

  // Flash a card row when its status changes during a poll.
  useEffect(() => {
    if (!listQuery.data) return;
    const timers: number[] = [];
    for (const c of cards) {
      const prev = lastStatusRef.current[c.id];
      if (prev && prev !== c.status) {
        setFlashId(c.id);
        timers.push(window.setTimeout(() => setFlashId(null), 1000));
      }
      lastStatusRef.current[c.id] = c.status;
    }
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [cards, listQuery.data]);

  const visible = useMemo(() => {
    const filtered = cards.filter((c) => {
      if (filter === 'all') return true;
      if (filter === 'terminal') return TERMINAL.includes(c.status);
      return c.status === filter;
    });
    return [...filtered].sort((a, b) => {
      const ra = STATUS_RANK[a.status] ?? 9;
      const rb = STATUS_RANK[b.status] ?? 9;
      if (ra !== rb) return ra - rb;
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [cards, filter]);

  const openCount = cards.filter((c) => c.status === 'open').length;
  const selectedCard = detailQuery.data;

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: ActionKind }) => api.healAction(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heals'] });
      if (cardId) queryClient.invalidateQueries({ queryKey: ['heal', cardId] });
    },
  });

  // Clear any stale action error/pending affordance when switching cards so an
  // error from one card never bleeds onto another.
  const mutationReset = actionMutation.reset;
  useEffect(() => {
    mutationReset();
  }, [cardId, mutationReset]);

  function doAction(action: ActionKind) {
    if (!cardId || actionMutation.isPending) return;
    // Clear any prior action error when starting a new action.
    actionMutation.reset();
    if (action === 'decline' || action === 'dismiss-fixed' || action === 'dismiss-ignore') {
      setConfirm(action);
      return;
    }
    actionMutation.mutate({ id: cardId, action });
  }

  function confirmAndExecute() {
    if (!cardId || !confirm) return;
    actionMutation.mutate({ id: cardId, action: confirm });
    setConfirm(null);
  }

  // Which action (if any) is currently in flight, and any error from the last
  // action — surfaced inline near the action bar.
  const pendingAction: ActionKind | null = actionMutation.isPending
    ? actionMutation.variables?.action ?? null
    : null;
  const actionError: string | null = actionMutation.isError
    ? actionMutation.error instanceof Error
      ? actionMutation.error.message
      : 'Something went wrong.'
    : null;

  function selectCard(id: string) {
    if (!detailOpen) setDetailOpen(true);
    navigate(`/projects/${slug}/heals/${id}`);
  }

  // Splitter drag
  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    function move(ev: MouseEvent) {
      const pct = ((ev.clientX - rect!.left) / rect!.width) * 100;
      setSplitPct(Math.max(26, Math.min(74, pct)));
    }
    function up() {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  const isEmpty = !listQuery.isLoading && cards.length === 0;
  const showDetail = detailOpen && !isEmpty;

  return (
    <ProjectShell slug={slug} active="heals" project={projectName}>
      <div
        className={'he-page' + (dragging ? ' is-dragging' : '')}
        ref={pageRef}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <div className="page-header">
          <div>
            <h1 className="page-title">Heals</h1>
            <div className="page-sub">
              <span className="he-live" title="Updated every 12 seconds">
                <span className="he-live-dot" />Live
              </span>
              {isEmpty ? '0 cards' : `${cards.length} cards · ${openCount} awaiting decision`}
            </div>
          </div>
        </div>

        <div
          className="he-split-row"
          style={{ display: 'flex', flex: 1, minHeight: 0 }}
        >
        <div
          className="he-queue"
          style={showDetail ? { width: `${splitPct}%` } : { flex: 1, width: 'auto' }}
        >
          <div className="he-queue-head">
            <div className="he-chips">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={'he-chip' + (filter === f.id ? ' is-active' : '')}
                  onClick={() => setFilter(f.id)}
                >{f.label}</button>
              ))}
            </div>
          </div>

          <div className="he-queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading heals…" />
            ) : listQuery.isError ? (
              <ErrorState
                message={listQuery.error instanceof Error ? listQuery.error.message : undefined}
                onRetry={() => listQuery.refetch()}
              />
            ) : isEmpty ? (
              <div className="he-queue-empty">
                <svg width="30" height="30" viewBox="0 0 34 34" fill="none">
                  <g transform="rotate(45 17 17)">
                    <rect x="4" y="12" width="26" height="10" rx="5" stroke="var(--po-fg-4)" strokeWidth="1.6" />
                    <circle cx="17" cy="17" r="3" stroke="var(--po-fg-4)" strokeWidth="1.4" />
                  </g>
                </svg>
                <div className="he-queue-empty-t">No heals yet. Failing traces will cluster here.</div>
                <div className="he-queue-empty-s">Heals appear automatically as the eval worker finds patterns.</div>
              </div>
            ) : (
              visible.map((c) => (
                <QueueRow
                  key={c.id}
                  card={c}
                  selected={c.id === cardId}
                  flash={c.id === flashId}
                  onClick={() => selectCard(c.id)}
                />
              ))
            )}
          </div>
        </div>

        {showDetail && (
          <div
            className={'he-splitter' + (dragging ? ' is-dragging' : '')}
            onMouseDown={startDrag}
            onDoubleClick={() => setSplitPct(42)}
            title="Drag to resize · double-click to reset"
          >
            <span className="he-splitter-grip" />
            <button
              type="button"
              className="he-splitter-collapse"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setDetailOpen(false)}
              title="Hide detail panel"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M10 3l-4 5 4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        {showDetail ? (
          <DetailPane
            card={selectedCard}
            isLoading={!!cardId && detailQuery.isLoading}
            isError={!!cardId && detailQuery.isError}
            loadError={detailQuery.error instanceof Error ? detailQuery.error.message : undefined}
            onRetry={() => detailQuery.refetch()}
            onAction={doAction}
            onCollapse={() => setDetailOpen(false)}
            pendingAction={pendingAction}
            actionError={actionError}
          />
        ) : (!isEmpty && (
          <button type="button" className="he-reopen" onClick={() => setDetailOpen(true)} title="Show detail panel">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6.5 3l4 5-4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 3v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="he-reopen-label">Detail</span>
          </button>
        ))}
        </div>

        {confirm && (
          <ConfirmModal
            kind={confirm}
            onConfirm={confirmAndExecute}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>
    </ProjectShell>
  );
}
