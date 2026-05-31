import { useEffect, useState } from 'react';
import type { Provider } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type Mode = 'sign-in' | 'sign-up';

export default function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Bounce signed-in users to where they came from, or to the projects home.
  useEffect(() => {
    if (loading || !session) return;
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
    navigate(from ?? '/projects', { replace: true });
  }, [session, loading, navigate, location.state]);

  function clearMessages() {
    setError(null);
    setInfo(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setSubmitting(true);
    try {
      if (mode === 'sign-in') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // onAuthStateChange will fire and the effect above will redirect.
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/projects` },
        });
        if (err) throw err;
        // If email confirmation is required, no session is returned yet.
        if (!data.session) {
          setInfo('Account created. Check your inbox to confirm your email, then sign in.');
          setMode('sign-in');
          setPassword('');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onOAuth(provider: Provider) {
    clearMessages();
    setOauthLoading(provider);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/projects` },
      });
      if (err) throw err;
      // Browser is about to be redirected to the provider's consent screen.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth sign-in failed.');
      setOauthLoading(null);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          padding: '32px',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 6,
          }}
        >
          veralith
        </div>
        <h1 style={{ margin: '0 0 4px 0', fontSize: 22, fontWeight: 600 }}>
          {mode === 'sign-in' ? 'Sign in' : 'Create your account'}
        </h1>
        <p style={{ margin: '0 0 24px 0', color: 'var(--fg-3)', fontSize: 13 }}>
          {mode === 'sign-in'
            ? 'Welcome back. Sign in to continue.'
            : 'Start diagnosing your RAG pipeline in minutes.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <OAuthButton
            provider="google"
            label="Continue with Google"
            loading={oauthLoading === 'google'}
            disabled={submitting || oauthLoading !== null}
            onClick={() => onOAuth('google')}
          />
          <OAuthButton
            provider="github"
            label="Continue with GitHub"
            loading={oauthLoading === 'github'}
            disabled={submitting || oauthLoading !== null}
            onClick={() => onOAuth('github')}
          />
        </div>

        <Divider label="or" />

        <form onSubmit={onSubmit} style={{ marginTop: 20 }}>
          <Field
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={submitting || oauthLoading !== null}
            required
            autoFocus
          />
          <div style={{ height: 12 }} />
          <Field
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 6 characters"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            disabled={submitting || oauthLoading !== null}
            required
            minLength={6}
          />

          {error ? <Message kind="error">{error}</Message> : null}
          {info ? <Message kind="info">{info}</Message> : null}

          <button
            type="submit"
            disabled={submitting || oauthLoading !== null || !email || !password}
            style={{
              width: '100%',
              marginTop: 20,
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: 14,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting || !email || !password ? 0.6 : 1,
            }}
          >
            {submitting
              ? mode === 'sign-in'
                ? 'Signing in…'
                : 'Creating account…'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--fg-3)',
          }}
        >
          {mode === 'sign-in' ? (
            <>
              No account?{' '}
              <ModeToggle onClick={() => { setMode('sign-up'); clearMessages(); }}>
                Sign up
              </ModeToggle>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <ModeToggle onClick={() => { setMode('sign-in'); clearMessages(); }}>
                Sign in
              </ModeToggle>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'>) {
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: 12,
          color: 'var(--fg-2)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--bg)',
          color: 'var(--fg)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          outline: 'none',
        }}
      />
    </div>
  );
}

function OAuthButton({
  provider,
  label,
  loading,
  disabled,
  onClick,
}: {
  provider: 'google' | 'github';
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 16px',
        background: 'var(--panel-2)',
        color: 'var(--fg)',
        border: '1px solid var(--line-2)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !loading ? 0.5 : 1,
      }}
    >
      {provider === 'google' ? <GoogleIcon /> : <GitHubIcon />}
      <span>{loading ? 'Redirecting…' : label}</span>
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: 'var(--fg-4)',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      <span>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
    </div>
  );
}

function Message({ kind, children }: { kind: 'error' | 'info'; children: React.ReactNode }) {
  const isError = kind === 'error';
  return (
    <div
      style={{
        marginTop: 12,
        padding: '8px 12px',
        background: isError ? 'rgba(226, 92, 92, 0.1)' : 'rgba(111, 214, 196, 0.08)',
        border: `1px solid ${isError ? 'rgba(226, 92, 92, 0.3)' : 'rgba(111, 214, 196, 0.25)'}`,
        borderRadius: 'var(--radius-sm)',
        color: isError ? 'var(--cell-cu)' : 'var(--accent)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function ModeToggle({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'var(--accent)',
        fontSize: 13,
        cursor: 'pointer',
        textDecoration: 'underline',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.83 1.24 1.83 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.31-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.86.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.82 1.1.82 2.22 0 1.61-.02 2.9-.02 3.3 0 .32.22.7.83.58A12.01 12.01 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
