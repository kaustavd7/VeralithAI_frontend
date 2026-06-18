import { useEffect, useState } from 'react';
import type { Provider } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { BrandMark } from '../components/brand/Brand';
import '../styles/login.css';

type Mode = 'sign-in' | 'sign-up';

export default function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Start in sign-up mode when arrived via ?mode=signup (e.g. the marketing
  // site's "Start free" button); default to sign-in otherwise.
  const [mode, setMode] = useState<Mode>(() => {
    const m = new URLSearchParams(window.location.search).get('mode');
    return m === 'signup' || m === 'sign-up' ? 'sign-up' : 'sign-in';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) throw err;
      // Browser is about to be redirected to the provider's consent screen.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth sign-in failed.');
      setOauthLoading(null);
    }
  }

  const busy = submitting || oauthLoading !== null;

  return (
    <main className="lg-page">
      <div className="lg-form-col">
        <div className="lg-form">
          <div className="lg-brandline">
            <BrandMark size={42} />
            <span className="lg-brandline-name">veralith</span>
          </div>

          <h1 className="lg-h1">{mode === 'sign-in' ? 'Sign in' : 'Create your account'}</h1>
          <p className="lg-sub">
            {mode === 'sign-in'
              ? 'Welcome back. Sign in to continue.'
              : 'Start diagnosing your RAG pipeline in minutes.'}
          </p>

          <div className="lg-oauth">
            <OAuthButton
              provider="google"
              label="Continue with Google"
              loading={oauthLoading === 'google'}
              disabled={busy}
              onClick={() => onOAuth('google')}
            />
            <OAuthButton
              provider="github"
              label="Continue with GitHub"
              loading={oauthLoading === 'github'}
              disabled={busy}
              onClick={() => onOAuth('github')}
            />
          </div>

          <div className="lg-divider">
            <span>or</span>
          </div>

          <form onSubmit={onSubmit}>
            <div className="lg-field">
              <label className="lg-label" htmlFor="email">
                Email
              </label>
              <div className="lg-input-wrap">
                <input
                  id="email"
                  className="lg-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={busy}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="lg-field">
              <label className="lg-label" htmlFor="password">
                Password
              </label>
              <div className="lg-input-wrap">
                <input
                  id="password"
                  className="lg-input has-toggle"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  disabled={busy}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error ? <div className="lg-msg is-error">{error}</div> : null}
            {info ? <div className="lg-msg is-info">{info}</div> : null}

            <button type="submit" className="lg-submit" disabled={busy || !email || !password}>
              {submitting
                ? mode === 'sign-in'
                  ? 'Signing in…'
                  : 'Creating account…'
                : mode === 'sign-in'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>

          <div className="lg-foot">
            {mode === 'sign-in' ? (
              <>
                No account?{' '}
                <button
                  type="button"
                  className="lg-link"
                  onClick={() => {
                    setMode('sign-up');
                    clearMessages();
                  }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="lg-link"
                  onClick={() => {
                    setMode('sign-in');
                    clearMessages();
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <aside className="lg-brand-col" aria-hidden="true">
        <div className="lg-brand-glow" />
        <BrandMark size={540} tile={false} className="lg-brand-watermark" />

        <div className="lg-brand-body">
          <div className="lg-brand-eyebrow">RAG observability &amp; self-healing</div>
          <h2 className="lg-brand-head">
            Know the moment your RAG goes <em>wrong</em>.
          </h2>
          <p className="lg-brand-text">
            Veralith traces every retrieval-augmented answer back to its sources, flags
            hallucinations as they happen, and heals the gaps in your pipeline — automatically.
          </p>
        </div>

        <div className="lg-brand-caps">
          <span className="lg-cap">
            <TraceIcon /> Trace
          </span>
          <span className="lg-cap">
            <DiagnoseIcon /> Diagnose
          </span>
          <span className="lg-cap">
            <HealIcon /> Self-heal
          </span>
        </div>
      </aside>
    </main>
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
    <button type="button" className="lg-oauth-btn" onClick={onClick} disabled={disabled}>
      {provider === 'google' ? <GoogleIcon /> : <GitHubIcon />}
      <span>{loading ? 'Redirecting…' : label}</span>
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function TraceIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M2 4h12M2 8h12M2 12h8" />
    </svg>
  );
}

function DiagnoseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 8.5h3l2-4 2.5 7 2-3h3" />
    </svg>
  );
}

function HealIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
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
