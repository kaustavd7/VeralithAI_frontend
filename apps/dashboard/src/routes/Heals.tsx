import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation, keepPreviousData } from '@tanstack/react-query';
import { api } from '../api/client';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import { LoadingState, ErrorState } from '../components/StateViews';
import { Skel, SkelStatus } from '../components/Skeleton';
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
   Status buckets — used only to seed the canvas auto-layout (one cluster
   column per lifecycle phase, left → right). Cards stay free-movable after.
   ─────────────────────────────────────────────────────────── */

type BucketDef = { id: string; statuses: HealStatus[] };

const BUCKETS: BucketDef[] = [
  { id: 'open',        statuses: ['open'] },
  { id: 'in_progress', statuses: ['in_progress'] },
  { id: 'pr_raised',   statuses: ['pr_raised'] },
  { id: 'failed',      statuses: ['failed'] },
  { id: 'done',        statuses: ['resolved', 'manually_fixed', 'wont_fix', 'superseded'] },
];

/* ─────────────────────────────────────────────────────────────
   Canvas geometry + per-project layout persistence
   ─────────────────────────────────────────────────────────── */

type Pos = { x: number; y: number };

const NODE_W = 232;
const ROW_H = 132;
const COL_GAP = 40;
const PAD = 14;

/* Cluster cards by status into left→right columns (newest first within each). */
function autoLayout(cards: HealCardSummary[]): Record<string, Pos> {
  const res: Record<string, Pos> = {};
  BUCKETS.forEach((bucket, ci) => {
    const x = PAD + ci * (NODE_W + COL_GAP);
    cards
      .filter((c) => bucket.statuses.includes(c.status))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .forEach((c, ri) => {
        res[c.id] = { x, y: PAD + ri * ROW_H };
      });
  });
  return res;
}

const LS_KEY = (pid: string) => `veralith.heals.layout.${pid}`;
function loadLayout(pid: string): Record<string, Pos> {
  try {
    const raw = localStorage.getItem(LS_KEY(pid));
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? (o as Record<string, Pos>) : {};
  } catch {
    return {};
  }
}
function saveLayout(pid: string, p: Record<string, Pos>) {
  try {
    localStorage.setItem(LS_KEY(pid), JSON.stringify(p));
  } catch {
    /* storage full / unavailable — layout just won't persist */
  }
}

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
/* heal mark — a "+" cross inside the node's tinted icon tile */
function HealGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 3.4v9.2M3.4 8h9.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5, verticalAlign: '-1px' }}>
      <path d="M11.5 7a4.5 4.5 0 1 1-1.3-3.1M11.5 1.5V4H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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

/* Touch screens get the canvas as a plain list (drag is pointless), so we swap
   the pointer-drag handlers for a tap-to-open click. */
function useIsMobile(query = '(max-width: 768px)') {
  const [match, setMatch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/* ─────────────────────────────────────────────────────────────
   Heal node — a Railway-style draggable card on the canvas
   ─────────────────────────────────────────────────────────── */

function HealNode({
  card, pos, selected, flash, dragging, mobile, onPointerDown, onPointerMove, onPointerUp, onOpen,
}: {
  card: HealCardSummary;
  pos: Pos;
  selected: boolean;
  flash: boolean;
  dragging: boolean;
  mobile: boolean;
  onPointerDown: (e: React.PointerEvent, card: HealCardSummary) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent, card: HealCardSummary) => void;
  onOpen: (id: string) => void;
}) {
  const m = STATUS_META[card.status] ?? { label: card.status, phrase: null, color: 'var(--po-grey)' };
  const interaction = mobile
    ? { onClick: () => onOpen(card.id) }
    : {
        onPointerDown: (e: React.PointerEvent) => onPointerDown(e, card),
        onPointerMove,
        onPointerUp: (e: React.PointerEvent) => onPointerUp(e, card),
      };
  return (
    <div
      className={'he-node' + (selected ? ' is-selected' : '') + (flash ? ' is-flash' : '') + (dragging ? ' is-dragging' : '')}
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, '--c': m.color } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`${card.title} — ${m.label}`}
      title={card.title}
      {...interaction}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(card.id);
        }
      }}
    >
      <div className="he-node-top">
        <span className="he-node-ic"><HealGlyph /></span>
        <div className="he-node-headings">
          <div className="he-node-title">{card.title}</div>
          <div className="he-node-sub">{card.suggestion_slug}</div>
        </div>
      </div>
      <div className="he-node-foot">
        <span className="he-node-status">
          <span className={'he-node-dot' + (m.pulse ? ' is-pulse' : '')} />
          {m.label}
        </span>
        <span className="he-node-meta">
          {card.pr_url && <span className="he-node-pr">PR</span>}
          <span className="he-node-traces"><TracesIcon />{card.n_traces}</span>
          <span className="he-node-time">{relativeTime(card.last_trace_at)}</span>
        </span>
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

/* The copy-paste command that starts Claude Code and drives the whole heal via
   the veralith MCP (start_heal → claim → get_work_item → edit → PR →
   mark_pr_raised). Replaces the old "Heal with Claude Code" button, which only
   queued the action and relied on the user separately running a slash command. */
function healCommandFor(cardId: string): string {
  return (
    `claude "Heal Veralith card ${cardId}: use the veralith MCP — call start_heal ` +
    `with heal_card_id ${cardId}, then claim_work_item, get_work_item, apply the ` +
    `recommended fix in this repo, open a PR, and call mark_pr_raised."`
  );
}

function HealCommand({ cardId, verb }: { cardId: string; verb: string }) {
  const [copied, setCopied] = useState(false);
  const command = healCommandFor(cardId);
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard denied — user can still select the text manually */
    }
  }
  return (
    <div className="he-cmd">
      <div className="he-cmd-label">{verb} — run this in your repo terminal (Claude Code + veralith MCP)</div>
      <div className="he-cmd-row">
        <code className="he-cmd-code" title={command}>{command}</code>
        <button type="button" className="he-btn he-btn-primary he-cmd-copy" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

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
      <HealCommand cardId={card.id} verb="Heal with Claude Code" />
      {IgnoreSplit}
    </>;
  } else if (st === 'failed') {
    buttons = <>
      <HealCommand cardId={card.id} verb="Retry the heal" />
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
            Paste the command into your repo terminal — Claude Code (with the veralith MCP
            configured) starts the heal, edits the code, and opens a PR. Watch this card for
            updates — typically 1–5 minutes.
          </span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Detail pane — rendered inside the floating panel
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
   Heal panel — one floating, self-contained detail panel in the stack. Each
   runs its own detail query + actions; only the top panel is interactive.
   ─────────────────────────────────────────────────────────── */

function HealPanel({
  cardId, depth, isTop, zIndex, onClose,
}: {
  cardId: string;
  depth: number;
  isTop: boolean;
  zIndex: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);

  const detailQuery = useQuery({
    queryKey: ['heal', cardId],
    queryFn: () => api.getHeal(cardId),
    refetchInterval: (qq) => {
      const data = qq.state.data as HealCardDetail | undefined;
      if (!data) return false;
      return TERMINAL.includes(data.status) ? false : 5_000;
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ action }: { action: ActionKind }) => api.healAction(cardId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heals'] });
      queryClient.invalidateQueries({ queryKey: ['heal', cardId] });
    },
  });

  function doAction(action: ActionKind) {
    if (actionMutation.isPending) return;
    actionMutation.reset();
    if (action === 'decline' || action === 'dismiss-fixed' || action === 'dismiss-ignore') {
      setConfirm(action);
      return;
    }
    actionMutation.mutate({ action });
  }
  function confirmAndExecute() {
    if (!confirm) return;
    actionMutation.mutate({ action: confirm });
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

  // Focus the panel when it becomes the top of the stack.
  useEffect(() => {
    if (isTop) panelRef.current?.focus();
  }, [isTop]);

  // Esc closes the top panel — unless its own confirm dialog is open (the modal
  // handles Esc itself in that case).
  useEffect(() => {
    if (!isTop) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !confirm) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isTop, confirm, onClose]);

  return (
    <div
      className={'he-panel-wrap' + (isTop ? ' is-top' : '')}
      style={{ '--d': depth, zIndex } as React.CSSProperties}
    >
      <div className="he-panel" ref={panelRef} tabIndex={-1} role="dialog" aria-label="Heal card detail">
        <DetailPane
          card={detailQuery.data}
          isLoading={detailQuery.isLoading}
          isError={detailQuery.isError}
          loadError={detailQuery.error instanceof Error ? detailQuery.error.message : undefined}
          onRetry={() => detailQuery.refetch()}
          onAction={doAction}
          onClose={onClose}
          pendingAction={pendingAction}
          actionError={actionError}
        />
      </div>
      {confirm && (
        <ConfirmModal kind={confirm} onConfirm={confirmAndExecute} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Skeleton — ghost nodes scattered on the canvas, so the loading → loaded
   swap is shift-free (same canvas, same absolutely-placed cards).
   ─────────────────────────────────────────────────────────── */

const SKELETON_GHOSTS: Pos[] = [
  { x: PAD, y: PAD },
  { x: PAD, y: PAD + ROW_H },
  { x: PAD + (NODE_W + COL_GAP), y: PAD },
  { x: PAD + (NODE_W + COL_GAP) * 2, y: PAD },
  { x: PAD + (NODE_W + COL_GAP) * 2, y: PAD + ROW_H },
  { x: PAD + (NODE_W + COL_GAP) * 3, y: PAD },
  { x: PAD + (NODE_W + COL_GAP) * 4, y: PAD },
];

function HealsSkeleton() {
  return (
    <>
      <SkelStatus label="Loading heals…" />
      <div className="he-canvas">
        <div className="he-canvas-inner">
          {SKELETON_GHOSTS.map((g, i) => (
            <div className="he-node he-node-ghost" key={i} style={{ transform: `translate3d(${g.x}px, ${g.y}px, 0)` }}>
              <div className="he-node-top">
                <Skel w={28} h={28} r={8} />
                <div className="he-node-headings" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skel w="90%" h={11} />
                  <Skel w="60%" h={9} />
                </div>
              </div>
              <div className="he-node-foot">
                <Skel w={72} h={10} />
                <Skel w={44} h={10} style={{ marginLeft: 'auto' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page — dotted canvas of draggable heal cards + floating detail panel
   ─────────────────────────────────────────────────────────── */

export default function Heals() {
  const { slug = '', cardId } = useParams<{ slug: string; cardId?: string }>();
  const navigate = useNavigate();
  const projects = useProjects();
  const activeProject = projects.data?.projects.find((p) => p.slug === slug || p.id === slug);
  const projectName = activeProject?.name ?? slug;
  const projectId = activeProject?.id ?? null;

  const [search, setSearch] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  // Panel stack: the route param is the TOP card; `belowStack` holds the cards
  // beneath it, so opening another card stacks a new panel on top.
  const [belowStack, setBelowStack] = useState<string[]>([]);
  const lastStatusRef = useRef<Record<string, HealStatus>>({});
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Canvas layout: user-moved positions (overrides) persisted per project;
  // anything without an override falls back to the status auto-layout.
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const isMobile = useIsMobile();

  // GET /v1/heals is global across the user's projects; we fetch everything and
  // scope to the active project client-side. Polling: 12s.
  const listQuery = useQuery({
    queryKey: ['heals', projectId, 'all'],
    queryFn: () => api.listHeals({ limit: 100 }),
    refetchInterval: 12_000,
    placeholderData: keepPreviousData,
  });

  // Scope the global list to the current project. Until the project resolves we
  // return nothing rather than the unscoped global list, so no cross-project
  // cards ever paint into the canvas.
  const cards: HealCardSummary[] = useMemo(() => {
    if (!projectId) return [];
    const all = listQuery.data ?? [];
    return all.filter((c) => c.project_id === projectId);
  }, [listQuery.data, projectId]);

  // Load the saved layout when the project changes.
  useEffect(() => {
    if (projectId) setPositions(loadLayout(projectId));
  }, [projectId]);

  // Auto-layout (clustered by status) — the fallback position for any card the
  // user hasn't explicitly moved.
  const fallback = useMemo(() => autoLayout(cards), [cards]);
  const posOf = (id: string): Pos => positions[id] ?? fallback[id] ?? { x: PAD, y: PAD };

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

  const q = search.trim().toLowerCase();
  const visibleCards = useMemo(() => {
    if (!q) return cards;
    return cards.filter(
      (c) => c.title.toLowerCase().includes(q) || c.suggestion_slug.toLowerCase().includes(q),
    );
  }, [cards, q]);

  const searching = q !== '';
  const noMatches = searching && visibleCards.length === 0 && cards.length > 0;

  // Canvas inner size — large enough to contain every card (so it scrolls).
  const bounds = useMemo(() => {
    let mx = 0, my = 0;
    for (const c of cards) {
      const p = positions[c.id] ?? fallback[c.id] ?? { x: PAD, y: PAD };
      if (p.x > mx) mx = p.x;
      if (p.y > my) my = p.y;
    }
    return { w: mx + NODE_W + 220, h: my + ROW_H + 140 };
  }, [cards, positions, fallback]);

  const openCount = cards.filter((c) => c.status === 'open').length;

  // The open panel stack: cards beneath + the route card on top.
  const fullStack = cardId ? [...belowStack, cardId] : [];
  const selectedIds = new Set(fullStack);

  function openCard(id: string) {
    if (id === cardId) return; // already the top panel
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    // If reopening a buried card, pull it out; push the current top beneath it.
    setBelowStack((b) => {
      const without = b.filter((x) => x !== id);
      return cardId ? [...without, cardId] : without;
    });
    navigate(`/projects/${slug}/heals/${id}`);
  }
  function closeTop() {
    if (belowStack.length) {
      const prev = belowStack[belowStack.length - 1]!;
      setBelowStack((b) => b.slice(0, -1));
      navigate(`/projects/${slug}/heals/${prev}`);
    } else {
      lastFocusedRef.current?.focus?.();
      navigate(`/projects/${slug}/heals`);
    }
  }

  /* ── drag handlers (pointer-capture; <4px movement counts as a click) ── */
  function onNodeDown(e: React.PointerEvent, card: HealCardSummary) {
    if (e.button !== 0) return;
    const p = posOf(card.id);
    dragRef.current = { id: card.id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
    setDragId(card.id);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* unsupported */ }
  }
  function onNodeMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (d.moved) {
      const nx = Math.max(0, d.ox + dx);
      const ny = Math.max(0, d.oy + dy);
      setPositions((prev) => ({ ...prev, [d.id]: { x: nx, y: ny } }));
    }
  }
  function onNodeUp(e: React.PointerEvent, card: HealCardSummary) {
    const d = dragRef.current;
    if (!d) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* unsupported */ }
    dragRef.current = null;
    setDragId(null);
    if (!d.moved) {
      openCard(card.id);
    } else if (projectId) {
      setPositions((prev) => { saveLayout(projectId, prev); return prev; });
    }
  }
  function resetLayout() {
    setPositions({});
    if (projectId) saveLayout(projectId, {});
  }

  const loading = listQuery.isLoading || projects.isLoading;
  const isEmpty = !loading && cards.length === 0;
  const countsText = isEmpty ? '0 cards' : `${cards.length} cards · ${openCount} awaiting decision`;

  return (
    <ProjectShell slug={slug} active="heals" project={projectName}>
      <div className={'he-canvas-page' + (dragId ? ' is-dragging' : '')}>
        <div className="he-toolbar">
          <div className="he-toolbar-titles">
            <h1 className="he-toolbar-title">Heals</h1>
            <div className="he-toolbar-sub">
              <span className="he-live" title="Updated every 12 seconds">
                <span className="he-live-dot" />Live
              </span>
              <span>{loading ? 'Loading…' : countsText}</span>
            </div>
          </div>
          {!loading && !isEmpty && (
            <div className="he-toolbar-actions">
              <button type="button" className="he-btn he-btn-ghost" onClick={resetLayout} title="Re-arrange cards by status">
                <ResetIcon />Reset layout
              </button>
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
            </div>
          )}
        </div>

        {loading ? (
          <HealsSkeleton />
        ) : listQuery.isError ? (
          <div className="he-canvas">
            <div className="he-canvas-inner he-canvas-inner-center">
              <ErrorState
                message={listQuery.error instanceof Error ? listQuery.error.message : undefined}
                onRetry={() => listQuery.refetch()}
              />
            </div>
          </div>
        ) : (
          <div className="he-canvas">
            <div
              className={'he-canvas-inner' + (isEmpty || noMatches ? ' he-canvas-inner-center' : '')}
              style={isEmpty || noMatches ? undefined : { minWidth: bounds.w, minHeight: bounds.h }}
            >
              {isEmpty ? (
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
                visibleCards.map((card) => (
                  <HealNode
                    key={card.id}
                    card={card}
                    pos={posOf(card.id)}
                    selected={selectedIds.has(card.id)}
                    flash={card.id === flashId}
                    dragging={card.id === dragId}
                    mobile={isMobile}
                    onPointerDown={onNodeDown}
                    onPointerMove={onNodeMove}
                    onPointerUp={onNodeUp}
                    onOpen={openCard}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {fullStack.length > 0 && (
          <div className="he-panels">
            {fullStack.map((id, i) => (
              <HealPanel
                key={id}
                cardId={id}
                depth={fullStack.length - 1 - i}
                isTop={i === fullStack.length - 1}
                zIndex={200 + i}
                onClose={closeTop}
              />
            ))}
          </div>
        )}
      </div>
    </ProjectShell>
  );
}
