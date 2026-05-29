import { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AccountMenu } from './AccountMenu';

type Props = {
  workspace?: string;
  project: string;
  env?: 'production' | 'staging' | 'local';
};

export function ProjectTopbar({ workspace = 'workspace', project, env = 'local' }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();

  const initials = useMemo(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.['full_name'] as string | undefined) ?? (meta?.['name'] as string | undefined);
    const seed = full ?? user?.email ?? '';
    const parts = seed.split(/[\s@._-]/).filter(Boolean);
    if (parts.length === 0) return '·';
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
    return (first + second).toUpperCase();
  }, [user]);

  return (
    <div className="tb">
      <div className="tb-crumbs">
        <span className="tb-crumb">{workspace}</span>
        <span className="tb-crumb-sep">/</span>
        <span className="tb-crumb is-here">{project}</span>
        <span className={'tb-pill tb-pill-' + env}>
          <span className="tb-pill-dot" />
          {env}
        </span>
      </div>
      <div className="tb-right">
        <button className="tb-icon-btn" aria-label="Search" type="button" disabled>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
        <button className="tb-icon-btn" aria-label="Help" type="button" disabled>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M6.3 6.2c.2-1 1-1.7 2-1.7 1.1 0 1.9.7 1.9 1.7 0 .9-.7 1.3-1.4 1.7-.5.3-.8.7-.8 1.3v.4"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
          </svg>
        </button>
        <div className="tb-avatar-wrap">
          <button
            className={'tb-avatar' + (menuOpen ? ' is-open' : '')}
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            type="button"
          >
            {initials}
          </button>
          {menuOpen && <AccountMenu onClose={() => setMenuOpen(false)} />}
        </div>
      </div>
    </div>
  );
}
