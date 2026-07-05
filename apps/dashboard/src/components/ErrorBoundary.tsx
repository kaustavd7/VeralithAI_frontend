import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/* Catches render errors anywhere below it and shows a readable card instead of
   letting React unmount the whole tree (which leaves a blank white screen).
   Without this, a single bad field (e.g. a null failure_cell) blanks the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the real stack in the console for debugging.
    console.error('Dashboard render error:', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--po-bg, #0c0f14)',
          color: 'var(--po-fg, #e6edf3)',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            padding: '22px 24px',
            borderRadius: 12,
            border: '1px solid color-mix(in oklab, var(--po-bad, #e5534b) 40%, transparent)',
            background: 'color-mix(in oklab, var(--po-bad, #e5534b) 8%, transparent)',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong rendering this page
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--po-fg-2, #aab4c0)', marginBottom: 16 }}>
            The page hit an error and couldn’t render. Your data is safe — this is a
            display issue. Try reloading, or go back and open a different item.
          </div>
          <pre
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--po-bad, #e5534b)',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '10px 12px',
              margin: '0 0 16px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 160,
              overflow: 'auto',
            }}
          >
            {error.message || String(error)}
          </pre>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                padding: '9px 16px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: 'var(--accent, #3ad07a)',
                color: 'var(--accent-ink, #06150e)',
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                padding: '9px 16px',
                borderRadius: 6,
                border: '1px solid var(--po-line, #2b3240)',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--po-fg, #e6edf3)',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }
}
