import { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If user is already signed in, bounce to onboarding (or wherever they were trying to go).
  useEffect(() => {
    if (loading) return;
    if (session) {
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
      navigate(from ?? '/onboarding', { replace: true });
    }
  }, [session, loading, navigate, location.state]);

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
        <h1 style={{ margin: '0 0 24px 0', fontSize: 22, fontWeight: 600 }}>Sign in</h1>

        <Auth
          supabaseClient={supabase}
          providers={['google', 'github']}
          redirectTo={`${window.location.origin}/onboarding`}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#6fd6c4',
                  brandAccent: '#5fc4b2',
                  brandButtonText: '#0b0c0e',
                  defaultButtonBackground: '#15181c',
                  defaultButtonBackgroundHover: '#1a1e23',
                  defaultButtonBorder: '#2c3037',
                  defaultButtonText: '#e9ebee',
                  dividerBackground: '#23262b',
                  inputBackground: '#0b0c0e',
                  inputBorder: '#2c3037',
                  inputBorderHover: '#3a3f47',
                  inputBorderFocus: '#6fd6c4',
                  inputText: '#e9ebee',
                  inputLabelText: '#b6bac1',
                  inputPlaceholder: '#555b66',
                  messageText: '#b6bac1',
                  messageTextDanger: '#e25c5c',
                  anchorTextColor: '#b6bac1',
                  anchorTextHoverColor: '#e9ebee',
                },
                fonts: {
                  bodyFontFamily: 'IBM Plex Sans, sans-serif',
                  buttonFontFamily: 'IBM Plex Sans, sans-serif',
                  inputFontFamily: 'IBM Plex Sans, sans-serif',
                  labelFontFamily: 'IBM Plex Sans, sans-serif',
                },
                radii: {
                  borderRadiusButton: '6px',
                  buttonBorderRadius: '6px',
                  inputBorderRadius: '6px',
                },
              },
            },
          }}
        />
      </div>
    </main>
  );
}
