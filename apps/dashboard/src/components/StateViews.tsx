import type { ReactNode } from 'react';

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

/* Brand-themed loader: Veralith = "true stone" (vera + lith). A cairn of
   balanced stones settles into place one stone at a time — the top stone is the
   emerald "lith". Pure CSS/SVG, token-driven, theme-aware, reduced-motion
   friendly. The whole figure fades in/out each cycle so the reset is unseen. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={wrap} role="status" aria-live="polite">
      <span className="sv-cairn" aria-hidden="true">
        <svg width="46" height="48" viewBox="0 0 46 48" fill="none">
          {/* ground shadow */}
          <ellipse className="sv-ground" cx="23" cy="44" rx="14" ry="2.4" />
          {/* stacked stones, widest at the base */}
          <ellipse className="sv-st sv-s1" cx="23" cy="38" rx="13" ry="4.6" />
          <ellipse className="sv-st sv-s2" cx="23" cy="29.5" rx="9.6" ry="4" />
          <ellipse className="sv-st-top sv-s3" cx="23" cy="21.5" rx="6.2" ry="3.4" />
        </svg>
      </span>
      <span style={subStyle}>{label}</span>
      <style>{`
        .sv-cairn{display:inline-flex}
        .sv-cairn svg{overflow:visible;animation:sv-cycle 2.4s ease-in-out infinite}
        .sv-ground{fill:color-mix(in oklab, var(--po-fg) 12%, transparent)}
        .sv-st{fill:color-mix(in oklab, var(--po-fg) 24%, transparent)}
        .sv-st-top{fill:var(--accent);
          filter:drop-shadow(0 0 5px color-mix(in oklab, var(--accent) 50%, transparent))}
        .sv-s1{animation:sv-s1 2.4s ease-in-out infinite}
        .sv-s2{animation:sv-s2 2.4s ease-in-out infinite}
        .sv-s3{animation:sv-s3 2.4s ease-in-out infinite}
        @keyframes sv-cycle{0%{opacity:0}10%{opacity:1}82%{opacity:1}100%{opacity:0}}
        @keyframes sv-s1{0%{opacity:0;transform:translateY(-8px)}18%,100%{opacity:1;transform:translateY(0)}}
        @keyframes sv-s2{0%,14%{opacity:0;transform:translateY(-8px)}38%,100%{opacity:1;transform:translateY(0)}}
        @keyframes sv-s3{0%,28%{opacity:0;transform:translateY(-8px)}56%,100%{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion: reduce){
          .sv-cairn svg,.sv-s1,.sv-s2,.sv-s3{animation:none}
          .sv-cairn svg{opacity:1}
          .sv-st,.sv-st-top{transform:translateY(0);opacity:1}
        }
      `}</style>
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
