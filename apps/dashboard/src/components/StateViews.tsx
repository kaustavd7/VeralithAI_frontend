import type { ReactNode } from 'react';
import { BrandLoader } from './brand/Brand';

/* ─────────────────────────────────────────────────────────────────────────
   Shared loading / error / empty states for data pages, so every page reads
   the same when a query is pending, fails, or returns nothing. Self-contained
   (token-based inline styles) — no external CSS dependency.
   ───────────────────────────────────────────────────────────────────────── */

const wrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: '64px 24px',
  textAlign: 'center',
  color: 'var(--po-fg-3)',
};
const titleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--po-fg)' };
const subStyle: React.CSSProperties = { fontSize: 13, color: 'var(--po-fg-3)', maxWidth: 420, lineHeight: 1.5 };

/* Brand loader — the Veralith "V" gem draws itself in (see components/brand). */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={wrap}>
      <BrandLoader size={60} label={label} />
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div style={wrap} role="alert">
      <span style={{ ...titleStyle, color: 'var(--po-bad)' }}>Couldn’t load this</span>
      {message && <span style={subStyle}>{message}</span>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 4,
            height: 34,
            padding: '0 16px',
            background: 'var(--po-panel)',
            border: '1px solid var(--po-line)',
            borderRadius: 'var(--po-radius-sm)',
            color: 'var(--po-fg-2)',
            font: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div style={wrap}>
      <span style={titleStyle}>{title}</span>
      {sub && <span style={subStyle}>{sub}</span>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
