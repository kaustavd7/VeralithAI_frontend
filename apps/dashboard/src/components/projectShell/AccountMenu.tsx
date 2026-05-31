import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, type ThemeChoice } from '../../hooks/useTheme';

type Props = { onClose: () => void };

export function AccountMenu({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Display name + email derived from the Supabase user.
  const displayName = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    if (full) return full;
    return user?.email?.split('@')[0] ?? 'Signed in';
  }, [user]);

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }, []);

  // Outside click + Esc to close.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      const target = e.target as Node;
      if (ref.current.contains(target)) return;
      const avatar = (e.target as HTMLElement | null)?.closest('.tb-avatar');
      if (avatar) return; // toggle handled by the avatar button itself
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const themes: { id: ThemeChoice; label: string }[] = [
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'system', label: 'System' },
  ];

  async function onLogout() {
    await signOut();
    onClose();
    navigate('/login', { replace: true });
  }

  return (
    <div className="am" ref={ref} role="menu">
      <div className="am-user">
        <div className="am-user-name">{displayName}</div>
        <div className="am-user-email">{user?.email ?? ''}</div>
      </div>

      <div className="am-group">
        <button
          className="am-item"
          role="menuitem"
          type="button"
          onClick={() => { onClose(); navigate('/settings'); }}
        >
          <svg className="am-ic" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M8 1.5v2 M8 12.5v2 M1.5 8h2 M12.5 8h2 M3.3 3.3l1.4 1.4 M11.3 11.3l1.4 1.4 M3.3 12.7l1.4-1.4 M11.3 4.7l1.4-1.4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Settings
        </button>
        <button className="am-item" role="menuitem" type="button" disabled>
          <svg className="am-ic" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 8h6 M11 8v2 M13 8v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          API keys
        </button>
        <button className="am-item" role="menuitem" type="button" disabled>
          <svg className="am-ic" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="3.5" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M4 7h.5 M6.5 7h.5 M9 7h.5 M11.5 7h.5 M4.5 10h7"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Keyboard shortcuts
          <span className="am-kbd po-mono">⌘?</span>
        </button>
        <button className="am-item" role="menuitem" type="button" disabled>
          <svg className="am-ic" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 3h7l3 3v7H3z" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <path d="M10 3v3h3" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Documentation
        </button>
      </div>

      <div className="am-sep" />

      <div className="am-section">
        <div className="am-section-label">Theme</div>
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'am-item am-theme' + (theme === t.id ? ' is-active' : '')}
            role="menuitemradio"
            aria-checked={theme === t.id}
            onClick={() => setTheme(t.id)}
          >
            <span className="am-radio">
              <span className="am-radio-dot" />
            </span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="am-sep" />

      <button className="am-item am-tz" role="menuitem" type="button" disabled>
        <svg className="am-ic" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M2 8h12 M8 2c1.6 2 1.6 10 0 12 M8 2c-1.6 2-1.6 10 0 12"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
        <div className="am-tz-body">
          <div>Timezone</div>
          <div className="am-tz-sub">Auto ({tz})</div>
        </div>
        <span className="am-chev">›</span>
      </button>

      <div className="am-sep" />

      <button className="am-item am-logout" role="menuitem" type="button" onClick={onLogout}>
        <svg className="am-ic" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M9 3H4a1 1 0 00-1 1v8a1 1 0 001 1h5 M11 5l3 3-3 3 M6.5 8h7.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        Log out
      </button>
    </div>
  );
}
