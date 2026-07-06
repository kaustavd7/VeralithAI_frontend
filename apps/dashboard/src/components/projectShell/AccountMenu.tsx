import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, type ThemeChoice } from '../../hooks/useTheme';

type Props = { onClose: () => void };

const DOCS_URL = 'https://docs.veralithai.com';

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

  // Up to two initials for the generated avatar — from a full name when present,
  // otherwise the first letters of the email local-part.
  const initials = useMemo(() => {
    const source = displayName && displayName !== 'Signed in' ? displayName : user?.email ?? '';
    const parts = source
      .replace(/[._-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }, [displayName, user]);

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

  function goSettings() {
    onClose();
    navigate('/settings');
  }

  // API keys are managed (cross-project) under Settings.
  function goApiKeys() {
    onClose();
    navigate('/settings/api-keys');
  }

  return (
    <div className="am" ref={ref} role="menu">
      <div className="am-header">
        <div className="am-avatar" aria-hidden="true">{initials}</div>
        <div className="am-id">
          <div className="am-user-name">{displayName}</div>
          <div className="am-user-email">{user?.email ?? ''}</div>
        </div>
      </div>

      <div className="am-sep" />

      <div className="am-group">
        <button
          className="am-item"
          role="menuitem"
          type="button"
          onClick={goSettings}
        >
          <svg className="am-ic" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="am-item-label">Settings</span>
        </button>
        <button
          className="am-item"
          role="menuitem"
          type="button"
          onClick={goApiKeys}
        >
          <svg className="am-ic" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 8h6 M11 8v2 M13 8v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className="am-item-label">API keys</span>
        </button>
        <a
          className="am-item"
          role="menuitem"
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer"
          onClick={onClose}
        >
          <svg className="am-ic" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 3h7l3 3v7H3z" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <path d="M10 3v3h3" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <span className="am-item-label">Documentation</span>
          <svg className="am-ext" width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3h7v7 M13 3 7 9 M11 9v3.5a.5.5 0 0 1-.5.5H3.5a.5.5 0 0 1-.5-.5V5.5a.5.5 0 0 1 .5-.5H7"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>

      <div className="am-sep" />

      <div className="am-section">
        <div className="am-section-row">
          <span className="am-section-label">Theme</span>
          <div className="am-seg" role="radiogroup" aria-label="Theme">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                className={'am-seg-btn' + (theme === t.id ? ' is-active' : '')}
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => setTheme(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="am-sep" />

      <div className="am-group">
        <div className="am-item am-tz is-static" role="menuitem" aria-disabled="true">
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
            <div className="am-item-label">Timezone</div>
            <div className="am-tz-sub">Auto · {tz}</div>
          </div>
        </div>
      </div>

      <div className="am-sep" />

      <div className="am-group">
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
          <span className="am-item-label">Log out</span>
        </button>
      </div>
    </div>
  );
}
