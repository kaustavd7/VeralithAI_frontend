import { useEffect, useMemo, useRef, type ReactNode, type SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, type ThemeChoice } from '../../hooks/useTheme';

type Props = { onClose: () => void };

const DOCS_URL = 'https://docs.veralithai.com';

/* ── Icons (consistent 24-grid, 1.7 stroke, rounded) ───────────────────────── */
const ic = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } satisfies SVGProps<SVGSVGElement>;

const SettingsIcon = () => (
  <svg className="am-ic" {...ic}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h6M14 18h6" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="12" cy="18" r="2" /></svg>
);
const KeyIcon = () => (
  <svg className="am-ic" {...ic}><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 8.2-8.2M17 6l2 2M15 8l1.5 1.5" /></svg>
);
const DocIcon = () => (
  <svg className="am-ic" {...ic}><path d="M4 4a2 2 0 0 1 2-2h6l4 4v14a0 0 0 0 1 0 0 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M12 2v4a2 2 0 0 0 2 2h4M8 13h6M8 17h4" /></svg>
);
const MoonIcon = () => (<svg className="am-seg-ic" {...ic}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>);
const SunIcon = () => (<svg className="am-seg-ic" {...ic}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></svg>);
const MonitorIcon = () => (<svg className="am-seg-ic" {...ic}><rect x="2.5" y="4" width="19" height="12" rx="2" /><path d="M8.5 20h7M12 16v4" /></svg>);
const GlobeIcon = () => (<svg className="am-ic" {...ic}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" /></svg>);
const LogOutIcon = () => (<svg className="am-ic" {...ic}><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9" /></svg>);
const ExtIcon = () => (<svg className="am-ext" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></svg>);

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

  const themes: { id: ThemeChoice; label: string; icon: ReactNode }[] = [
    { id: 'dark', label: 'Dark', icon: <MoonIcon /> },
    { id: 'light', label: 'Light', icon: <SunIcon /> },
    { id: 'system', label: 'System', icon: <MonitorIcon /> },
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

      <div className="am-group">
        <button className="am-item" role="menuitem" type="button" onClick={goSettings}>
          <SettingsIcon />
          <span className="am-item-label">Settings</span>
        </button>
        <button className="am-item" role="menuitem" type="button" onClick={goApiKeys}>
          <KeyIcon />
          <span className="am-item-label">API keys</span>
        </button>
        <a className="am-item" role="menuitem" href={DOCS_URL} target="_blank" rel="noreferrer" onClick={onClose}>
          <DocIcon />
          <span className="am-item-label">Documentation</span>
          <ExtIcon />
        </a>
      </div>

      <div className="am-sep" />

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
              aria-label={t.label}
              title={t.label}
              onClick={() => setTheme(t.id)}
            >
              {t.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="am-sep" />

      <div className="am-foot">
        <div className="am-tz" title={`Timezone: ${tz}`}>
          <GlobeIcon />
          <span className="am-tz-text">Auto · {tz}</span>
        </div>
        <button className="am-item am-logout" role="menuitem" type="button" onClick={onLogout}>
          <LogOutIcon />
          <span className="am-item-label">Log out</span>
        </button>
      </div>
    </div>
  );
}
