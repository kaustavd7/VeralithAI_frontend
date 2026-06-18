import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation, keepPreviousData } from '@tanstack/react-query';
import { api } from '../api/client';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import { LoadingState, ErrorState } from '../components/StateViews';
import { Skel } from '../components/Skeleton';
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

/* ─────────────────────────────────────────────────────────────
   Kanban columns — the heal lifecycle, left → right. Each column owns one or
   more statuses; "Done" archives every terminal outcome.
   ─────────────────────────────────────────────────────────── */

type ColumnDef = {
  id: string;
  label: string;
  hint: string;
  empty: string;
  color: string;
  statuses: HealStatus[];
};

const COLUMNS: ColumnDef[] = [
  { id: 'open',        label: 'Open',        hint: 'Awaiting decision',   empty: 'Nothing awaiting decision', color: 'var(--accent)',  statuses: ['open'] },
  { id: 'in_progress', label: 'In progress', hint: 'Claude Code working', empty: 'Nothing in progress',       color: 'var(--cell-ig)', statuses: ['in_progress'] },
  { id: 'pr_raised',   label: 'PR raised',   hint: 'Review needed',       empty: 'No PRs to review',          color: 'var(--cell-cg)', statuses: ['pr_raised'] },
  { id: 'failed',      label: 'Failed',      hint: 'Needs retry',         empty: 'No failures',               color: 'var(--cell-cu)', statuses: ['failed'] },
  { id: 'done',        label: 'Done',        hint: 'Archived outcomes',   empty: 'No archived outcomes yet',  color: 'var(--po-grey)', statuses: ['resolved', 'manually_fixed', 'wont_fix', 'superseded'] },
];

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
function TracesIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 9.5h9M1.5 6h6M1.5 2.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
   KPI strip + achievement badges (computed client-side from the list)
   ─────────────────────────────────────────────────────────── */

function KpiStrip({ cards }: { cards: HealCardSummary[] }) {
  const count = (s: HealStatus) => cards.filter((c) => c.status === s).length;
  const open = count('open');
  const prog = count('in_progress');
  const pr = count('pr_raised');
  const resolved = count('resolved');
  const failed = count('failed');
  const denom = resolved + failed;
  const success = denom > 0 ? `${Math.round((resolved / denom) * 100)}%` : '—';

  const items: { label: string; value: string | number; tone?: 'accent' | 'good' | 'bad'; hint?: string }[] = [
    { label: 'Open', value: open, tone: open > 0 ? 'accent' : undefined, hint: 'Cards awaiting a decision' },
    { label: 'In progress', value: prog, hint: 'Claude Code is working on these' },
    { label: 'PR raised', value: pr, tone: pr > 0 ? 'good' : undefined, hint: 'PRs waiting for your review' },
    { label: 'Resolved', value: resolved, tone: 'good', hint: 'PRs accepted and merged' },
    { label: 'Success rate', value: success, hint: 'Resolved ÷ (Resolved + Failed) heal attempts' },
  ];

  return (
    <div className="he-kpis">
      {items.map((it) => (
        <div className="he-kpi" key={it.label} title={it.hint}>
          <span className="he-kpi-label">{it.label}</span>
          <span className={'he-kpi-val' + (it.tone ? ` is-${it.tone}` : '')}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function HealBadges({ cards }: { cards: HealCardSummary[] }) {
  const healed = cards.filter((c) => c.status === 'resolved' || c.status === 'manually_fixed').length;
  const anyPr = cards.some((c) => c.pr_url);
  const open = cards.filter((c) => c.status === 'open').length;

  const badges: { icon: string; label: string; got: boolean }[] = [
    { icon: '🩹', label: 'First heal', got: healed >= 1 },
    { icon: '🔀', label: 'First PR', got: anyPr },
    { icon: '🏅', label: '10 healed', got: healed >= 10 },
    { icon: '🥇', label: '50 healed', got: healed >= 50 },
    { icon: '✨', label: 'Inbox zero', got: cards.length > 0 && open === 0 },
  ];

  return (
    <div className="he-badges" title={`${healed} healed all-time`}>
      {badges.map((b) => (
        <span className={'he-bchip' + (b.got ? ' is-got' : '')} key={b.label}>
          <span className="he-bchip-ic">{b.icon}</span>
          {b.label}
        </span>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Kanban card + column
   ─────────────────────────────────────────────────────────── */

function KanbanCard({
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
      className={'he-kc' + (selected ? ' is-selected' : '') + (flash ? ' is-flash' : '')}
      style={{ '--c': m.color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="he-kc-top">
        <span className={'he-kc-dot' + (m.pulse ? ' is-pulse' : '')} />
        <span className="he-kc-title">{card.title}</span>
      </div>
      <div className="he-kc-meta">
        <span className="he-kc-traces"><TracesIcon />{card.n_traces}</span>
        {card.pr_url && <span className="he-kc-pr">PR<ExtLink /></span>}
        <span className="he-kc-time">{relativeTime(card.last_trace_at)}</span>
      </div>
    </button>
  );
}

function KanbanColumn({
  col, cards, selectedId, flashId, searching, onSelect,
}: {
  col: ColumnDef;
  cards: HealCardSummary[];
  selectedId: string | undefined;
  flashId: string | null;
  searching: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={'he-col he-col-' + col.id} style={{ '--c': col.color } as React.CSSProperties}>
      <div className="he-col-head">
        <span className="he-col-dot" />
        <span className="he-col-label">{col.label}</span>
        <span className="he-col-count">{cards.length}</span>
      </div>
      <div className="he-col-hint">{col.hint}</div>
      <div className="he-col-body">
        {cards.length === 0 ? (
          <div className="he-col-empty">{searching ? 'No matches' : col.empty}</div>
        ) : (
          cards.map((c) => (
            <KanbanCard
              key={c.id}
              card={c}
              selected={c.id === selectedId}
              flash={c.id === flashId}
              onClick={() => onSelect(c.id)}
            />
          ))
        )}
      </div>
    </div>
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
  const ctaRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ctaRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="he-modal-scrim" onClick={onCancel}>
      <div
        className="he-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="he-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="he-modal-title" id="he-confirm-title">{c.title}</div>
        <div className="he-modal-body">{c.body}</div>
        <div className="he-modal-actions">
          <button className="he-btn he-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            ref={ctaRef}
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
   Detail pane — rendered inside the slide-over
   ─────────────────────────────────────────────────────────── */

function DetailPane({
  card,
  isLoading,
  isError,
  loadError,
  onRetry,
  onAction,
  onClose,
  pendingAction,
  actionError,
}: {
  card: HealCardDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  loadError: string | undefined;
  onRetry: () => void;
  onAction: (a: ActionKind) => void;
  onClose: () => void;
  pendingAction: ActionKind | null;
  actionError: string | null;
}) {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const CloseBtn = (
    <button className="he-detail-close" onClick={onClose} title="Close (Esc)" aria-label="Close">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );

  if (isError && !card) {
    return (
      <div className="he-detail he-detail-empty">
        {CloseBtn}
        <ErrorState message={loadError} onRetry={onRetry} />
      </div>
    );
  }
  if (isLoading || !card) {
    return (
      <div className="he-detail he-detail-empty">
        {CloseBtn}
        <div className="he-placeholder">
          <LoadingState label="Loading heal card…" />
        </div>
      </div>
    );
  }
  const m = STATUS_META[card.status] ?? { label: card.status, phrase: null, color: 'var(--po-grey)' };
  const phrase = card.status === 'failed' ? card.failure_reason : m.phrase;
  return (
    <div className="he-detail">
      <div className="he-detail-head">
        {CloseBtn}
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
   Skeleton — mirrors the loaded board (KPI strip + Kanban columns) so the
   loading → loaded transition is shift-free. Reuses the SAME wrapper / grid /
   card classNames as the real UI; only the text/number content becomes shimmer.
   ─────────────────────────────────────────────────────────── */

function HealsSkeleton() {
  // Plausible card counts per column so the board reads as populated while
  // loading. Same .he-board grid → identical column widths/positions.
  const perColumn = [3, 2, 2, 1, 3];
  return (
    <>
      <div className="he-kpis">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="he-kpi" key={i}>
            <span className="he-kpi-label"><Skel w={64} h={10} /></span>
            <span className="he-kpi-val"><Skel w={34} h={22} /></span>
          </div>
        ))}
      </div>

      <div className="he-board">
        {COLUMNS.map((col, ci) => (
          <div className={'he-col he-col-' + col.id} key={col.id} style={{ '--c': col.color } as React.CSSProperties}>
            <div className="he-col-head">
              <span className="he-col-dot" />
              <span className="he-col-label"><Skel w={72} h={11} /></span>
              <span className="he-col-count"><Skel w={12} h={11} /></span>
            </div>
            <div className="he-col-hint"><Skel w={96} h={9} /></div>
            <div className="he-col-body">
              {Array.from({ length: perColumn[ci] ?? 2 }, (_, ki) => (
                <div className="he-kc" key={ki} style={{ '--c': col.color } as React.CSSProperties}>
                  <div className="he-kc-top">
                    <span className="he-kc-dot" />
                    <span className="he-kc-title" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <Skel w="100%" h={11} />
                      <Skel w="65%" h={11} />
                    </span>
                  </div>
                  <div className="he-kc-meta">
                    <Skel w={36} h={11} />
                    <Skel w={44} h={11} style={{ marginLeft: 'auto' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page — Kanban triage board + slide-over detail, inside the project shell
   ─────────────────────────────────────────────────────────── */

export default function Heals() {
  const { slug = '', cardId } = useParams<{ slug: string; cardId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projects = useProjects();
  const activeProject = projects.data?.projects.find((p) => p.slug === slug || p.id === slug);
  const projectName = activeProject?.name ?? slug;
  const projectId = activeProject?.id ?? null;

  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const lastStatusRef = useRef<Record<string, HealStatus>>({});
  const slideoverRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // GET /v1/heals is global across the user's projects; we fetch everything and
  // scope to the active project client-side. Columns own the status grouping,
  // so we no longer pass a server-side status_filter. Polling: 12s.
  const listQuery = useQuery({
    queryKey: ['heals', projectId, 'all'],
    queryFn: () => api.listHeals({ limit: 100 }),
    refetchInterval: 12_000,
    placeholderData: keepPreviousData,
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

  // Scope the global list to the current project. Until the project resolves we
  // return nothing rather than the unscoped global list, so no cross-project
  // cards ever paint into the board / KPIs.
  const cards: HealCardSummary[] = useMemo(() => {
    if (!projectId) return [];
    const all = listQuery.data ?? [];
    return all.filter((c) => c.project_id === projectId);
  }, [listQuery.data, projectId]);

  // Flash a card when its status changes during a poll.
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

  // Group cards into columns (newest-updated first), applying the search over
  // both title and suggestion slug.
  const byColumn = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (c: HealCardSummary) =>
      !q || c.title.toLowerCase().includes(q) || c.suggestion_slug.toLowerCase().includes(q);
    const map: Record<string, HealCardSummary[]> = {};
    for (const col of COLUMNS) {
      map[col.id] = cards
        .filter((c) => col.statuses.includes(c.status) && matches(c))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return map;
  }, [cards, search]);

  const searching = search.trim() !== '';
  const filteredTotal = COLUMNS.reduce((n, col) => n + (byColumn[col.id]?.length ?? 0), 0);
  const noMatches = searching && filteredTotal === 0 && cards.length > 0;

  const openCount = cards.filter((c) => c.status === 'open').length;
  const selectedCard = detailQuery.data;

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: ActionKind }) => api.healAction(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heals'] });
      if (cardId) queryClient.invalidateQueries({ queryKey: ['heal', cardId] });
    },
  });

  // Clear any stale action error/pending affordance when switching cards.
  const mutationReset = actionMutation.reset;
  useEffect(() => {
    mutationReset();
  }, [cardId, mutationReset]);

  function doAction(action: ActionKind) {
    if (!cardId || actionMutation.isPending) return;
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

  const pendingAction: ActionKind | null = actionMutation.isPending
    ? actionMutation.variables?.action ?? null
    : null;
  const actionError: string | null = actionMutation.isError
    ? actionMutation.error instanceof Error
      ? actionMutation.error.message
      : 'Something went wrong.'
    : null;

  function selectCard(id: string) {
    // Remember the trigger so focus can return there when the slide-over closes.
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    navigate(`/projects/${slug}/heals/${id}`);
  }
  function closeDetail() {
    lastFocusedRef.current?.focus?.();
    navigate(`/projects/${slug}/heals`);
  }

  // Move focus into the slide-over when it opens (backs up the aria-modal).
  useEffect(() => {
    if (cardId) slideoverRef.current?.focus();
  }, [cardId]);

  // While the slide-over is open: Esc closes it (unless a confirm dialog is up),
  // and Tab is trapped within the panel.
  useEffect(() => {
    if (!cardId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!confirm) closeDetail();
        return;
      }
      if (e.key === 'Tab' && !confirm) {
        const panel = slideoverRef.current;
        if (!panel) return;
        const f = panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea,select,[tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = f[0]!;
        const last = f[f.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, confirm]);

  const loading = listQuery.isLoading || projects.isLoading;
  const isEmpty = !loading && cards.length === 0;

  return (
    <ProjectShell slug={slug} active="heals" project={projectName}>
      <div className="he-page he-board-page" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="he-board-header">
          <div className="he-board-titles">
            <h1 className="page-title">Heals</h1>
            <div className="page-sub">
              <span className="he-live" title="Updated every 12 seconds">
                <span className="he-live-dot" />Live
              </span>
              {isEmpty ? '0 cards' : `${cards.length} cards · ${openCount} awaiting decision`}
            </div>
          </div>
          {!isEmpty && (
            <div className="he-board-search">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search by title or slug…"
                aria-label="Search heals by title or slug"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        {!loading && !listQuery.isError && !isEmpty && (
          <>
            <KpiStrip cards={cards} />
            <HealBadges cards={cards} />
          </>
        )}

        {loading ? (
          <HealsSkeleton />
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
        ) : noMatches ? (
          <div className="he-queue-empty">
            <div className="he-queue-empty-t">No heals match “{search.trim()}”.</div>
            <button type="button" className="he-btn he-btn-ghost" onClick={() => setSearch('')}>
              Clear search
            </button>
          </div>
        ) : (
          <div className="he-board">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                cards={byColumn[col.id] ?? []}
                selectedId={cardId}
                flashId={flashId}
                searching={searching}
                onSelect={selectCard}
              />
            ))}
          </div>
        )}

        {cardId && (
          <div className="he-slideover-scrim" onClick={closeDetail}>
            <div
              className="he-slideover"
              ref={slideoverRef}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Heal card detail"
            >
              <DetailPane
                card={selectedCard}
                isLoading={detailQuery.isLoading}
                isError={detailQuery.isError}
                loadError={detailQuery.error instanceof Error ? detailQuery.error.message : undefined}
                onRetry={() => detailQuery.refetch()}
                onAction={doAction}
                onClose={closeDetail}
                pendingAction={pendingAction}
                actionError={actionError}
              />
            </div>
          </div>
        )}

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
