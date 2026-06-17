import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LoadingState } from '../components/StateViews';

/* OAuth PKCE / magic-link landing page (PUBLIC route).
   supabase-js has detectSessionInUrl on by default, so it finishes the URL
   code exchange on load. We wait for a session (via getSession + the
   onAuthStateChange event, whichever resolves first), then replace-navigate
   to the intended target. This page is intentionally NOT behind RequireAuth,
   which would otherwise bounce the browser to /login mid-exchange. */
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let done = false;

    // Where the user was originally headed before being sent to /login → here.
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

    function finish() {
      if (done) return;
      done = true;
      navigate(from ?? '/projects', { replace: true });
    }

    function fail() {
      if (done) return;
      done = true;
      navigate('/login', { replace: true });
    }

    // If the exchange already completed (or there was an existing session),
    // getSession resolves with one and we leave immediately.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (done) return;
        if (error) {
          fail();
          return;
        }
        if (data.session) finish();
      })
      .catch(() => fail());

    // Otherwise the SIGNED_IN event fires once detectSessionInUrl finishes the
    // code exchange asynchronously.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    return () => {
      done = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, location.state]);

  return <LoadingState label="Finishing sign-in…" />;
}
