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

/* Brand-themed loader: Veralith = "true stone" (vera + lith). A sprout grows
   from a grounding stone — the self-heal / regeneration motif — in the Emerald
   Signal accent. Pure CSS/SVG, token-driven, theme-aware, and reduced-motion
   friendly. The whole figure fades in/out each cycle so the geometry reset is
   never visible. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={wrap} role="status" aria-live="polite">
      <span className="sv-sprout" aria-hidden="true">
        <svg width="44" height="48" viewBox="0 0 44 48" fill="none">
          <ellipse className="sv-stone" cx="22" cy="42" rx="12.5" ry="3.6" />
          <path className="sv-stem" d="M22 42 C22 34 22 28 22 20" />
          <path className="sv-leaf sv-leaf-l" d="M22 29 C14 28 9.5 21.5 11.5 14 C19 15 22.8 21.5 22 29 Z" />
          <path className="sv-leaf sv-leaf-r" d="M22 24 C29.5 23 34 17.5 32 10.5 C25 11.5 21.3 17.5 22 24 Z" />
        </svg>
      </span>
      <span style={subStyle}>{label}</span>
      <style>{`
        .sv-sprout{display:inline-flex}
        .sv-sprout svg{overflow:visible;
          filter:drop-shadow(0 0 5px color-mix(in oklab, var(--accent) 35%, transparent));
          animation:sv-cycle 2.4s ease-in-out infinite}
        .sv-stone{fill:color-mix(in oklab, var(--po-fg) 20%, transparent)}
        .sv-stem{stroke:var(--accent);stroke-width:2.4;stroke-linecap:round;fill:none;
          stroke-dasharray:24;stroke-dashoffset:24;animation:sv-stem 2.4s ease-in-out infinite}
        .sv-leaf{transform-box:fill-box;transform-origin:bottom center;transform:scale(0);opacity:0}
        .sv-leaf-l{fill:var(--accent);animation:sv-leaf-l 2.4s ease-in-out infinite}
        .sv-leaf-r{fill:color-mix(in oklab, var(--accent) 72%, var(--po-bg));
          animation:sv-leaf-r 2.4s ease-in-out infinite}
        @keyframes sv-cycle{0%{opacity:0}12%{opacity:1}80%{opacity:1}100%{opacity:0}}
        @keyframes sv-stem{0%{stroke-dashoffset:24}40%,100%{stroke-dashoffset:0}}
        @keyframes sv-leaf-l{0%,24%{transform:scale(0);opacity:0}56%,100%{transform:scale(1);opacity:1}}
        @keyframes sv-leaf-r{0%,32%{transform:scale(0);opacity:0}64%,100%{transform:scale(1);opacity:1}}
        @media (prefers-reduced-motion: reduce){
          .sv-sprout svg,.sv-stem,.sv-leaf-l,.sv-leaf-r{animation:none}
          .sv-sprout svg{opacity:1}
          .sv-stem{stroke-dashoffset:0}
          .sv-leaf{transform:scale(1);opacity:1}
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
