import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { AccountMenu } from './AccountMenu';

type Props = {
  /** Breadcrumb segment after the brand (e.g. "heals", "settings"). Empty = none. */
  crumb?: string;
};

/**
 * Topbar used by global (non-project) pages: ProjectsHome, Heals, Settings.
 * Per-project pages keep using `ProjectTopbar` inside `ProjectShell`.
 */
export function GlobalTopbar({ crumb }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [acctOpen, setAcctOpen] = useState(false);

  const displayName = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    return full ?? user?.email?.split('@')[0] ?? '';
  }, [user]);
  const initials = (displayName || user?.email || '··').slice(0, 2).toUpperCase();

  return (
    <header className="ph-top">
      <span
        className="ph-brand"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate('/projects')}
      >
        <span className="ph-brand-mark">
          <svg width="20" height="20" viewBox="0 0 22 22">
            <path
              d="M4 13.5 L7.5 6.5 L13 5 L18.5 9.5 L18 15 L11.5 19 L5 17.5 Z"
              fill="currentColor"
              fillOpacity="0.16"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M7.5 6.5 L11 11 L18.5 9.5 M11 11 L11.5 19 M11 11 L5 17.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeOpacity="0.55"
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="ph-brand-name">VeralithAI</span>
      </span>
      {crumb && (
        <>
          <span className="ph-crumb-sep">/</span>
          <span className="ph-crumb">{crumb}</span>
        </>
      )}
      <div className="ph-top-right">
        <span className="ph-avatar-wrap">
          <button
            type="button"
            className="ph-avatar tb-avatar"
            aria-haspopup="menu"
            aria-expanded={acctOpen}
            onClick={() => setAcctOpen((v) => !v)}
          >
            {initials}
          </button>
          {acctOpen && <AccountMenu onClose={() => setAcctOpen(false)} />}
        </span>
      </div>
    </header>
  );
}
