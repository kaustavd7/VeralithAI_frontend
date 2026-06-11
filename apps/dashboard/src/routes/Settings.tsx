import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import '../styles/project-shell.css';
import '../styles/project-page.css';
import type { Me } from '../api/types';

/* ─────────────────────────────────────────────────────────────
   Sidebar
   ─────────────────────────────────────────────────────────── */

const SE_ICONS = {
  profile: (
    <>
      <circle cx="8" cy="5.5" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 13.2c0-2.4 2.2-3.8 5-3.8s5 1.4 5 3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  'api-keys': (
    <>
      <circle cx="5.5" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8.3 8H14M11.5 8v2.4M13.2 8v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  billing: (
    <>
      <rect x="2" y="4" width="12" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 6.6h12" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  notifications: (
    <>
      <path d="M8 2.5c-2 0-3.2 1.4-3.2 3.4 0 3-1.3 3.8-1.3 3.8h9s-1.3-.8-1.3-3.8C11.2 3.9 10 2.5 8 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6.8 12a1.4 1.4 0 0 0 2.4 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
} as const;

type NavId = keyof typeof SE_ICONS;

const NAV: Array<{ id: NavId; label: string; disabled?: boolean; soon?: boolean; note?: string }> = [
  { id: 'profile',       label: 'Profile' },
  { id: 'api-keys',      label: 'API keys',       disabled: true, note: 'cross-project' },
  { id: 'billing',       label: 'Billing',        soon: true },
  { id: 'notifications', label: 'Notifications',  soon: true },
];

function SettingsSidebar({ active }: { active: NavId }) {
  return (
    <aside className="se-sidebar">
      <div className="se-sb-head">Settings</div>
      <nav className="se-sb-nav">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            disabled={n.disabled || n.soon}
            className={
              'se-sb-item' +
              (n.id === active ? ' is-active' : '') +
              (n.disabled || n.soon ? ' is-disabled' : '')
            }
          >
            <span className="se-sb-ic">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                {SE_ICONS[n.id]}
              </svg>
            </span>
            <span className="se-sb-label">{n.label}</span>
            {n.soon && <span className="se-soon">Coming soon</span>}
            {n.note && <span className="se-sb-note">{n.note}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────
   Identity panel
   ─────────────────────────────────────────────────────────── */

function IdentityPanel({ me }: { me: Me }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(me.display_name ?? '');

  return (
    <section className="se-panel">
      <div className="se-panel-h">Identity</div>
      <div className="se-rows">
        <div className="se-row">
          <div className="se-row-label">Email</div>
          <div className="se-row-val se-mono">{me.email}</div>
        </div>
        <div className="se-row">
          <div className="se-row-label">Display name</div>
          {editing ? (
            <div className="se-edit">
              <input
                className="se-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <div className="se-edit-actions">
                <button
                  className="se-btn se-btn-ghost"
                  type="button"
                  onClick={() => {
                    setDraft(me.display_name ?? '');
                    setEditing(false);
                  }}
                >Cancel</button>
                <span className="se-save-wrap" data-tip="Coming soon">
                  <button className="se-btn se-btn-primary" type="button" disabled>Save</button>
                </span>
              </div>
            </div>
          ) : (
            <div className="se-row-val se-row-val-edit">
              <span>{me.display_name ?? '—'}</span>
              <button
                className="se-edit-link"
                type="button"
                onClick={() => {
                  setDraft(me.display_name ?? '');
                  setEditing(true);
                }}
              >Edit</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Plan panel
   ─────────────────────────────────────────────────────────── */

function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  return Math.round(ms / 86_400_000);
}
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function PlanPanel({ me }: { me: Me }) {
  const now = new Date().toISOString();
  const totalDays = daysBetween(me.trial_started_at, me.trial_expires_at) || 14;
  const dayOf = Math.max(0, Math.min(totalDays, daysBetween(me.trial_started_at, now)));
  const expiresIn = Math.max(0, totalDays - dayOf);
  const nearExpiry = me.subscription_status === 'trialing' && expiresIn <= 3 && expiresIn > 0;
  const isActive = me.subscription_status === 'active';

  return (
    <section className="se-panel">
      <div className="se-panel-h">Plan</div>
      {nearExpiry && (
        <div className="se-banner">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5l6.5 11.5h-13L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M8 6.2v3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11.3" r="0.7" fill="currentColor" />
          </svg>
          <span>
            Your trial expires in <b>{expiresIn} day{expiresIn === 1 ? '' : 's'}</b>. We'll send a reminder.
            Billing isn't available yet — this is private alpha.
          </span>
        </div>
      )}
      <div className="se-plan-pillrow">
        <span className="se-plan-pill">{me.plan_tier === 'pro' ? 'Pro' : 'Trial'}</span>
        <span className="se-plan-status">
          {me.subscription_status} {!isActive && `· day ${dayOf} of ${totalDays}`}
        </span>
      </div>
      {!isActive ? (
        <div className="se-rows">
          <div className="se-row">
            <div className="se-row-label">Trial started</div>
            <div className="se-row-val">
              {formatDate(me.trial_started_at)} <span className="se-rel">({dayOf} day{dayOf === 1 ? '' : 's'} ago)</span>
            </div>
          </div>
          <div className="se-row">
            <div className="se-row-label">Trial expires</div>
            <div className="se-row-val">
              {formatDate(me.trial_expires_at)} <span className="se-rel">({expiresIn} day{expiresIn === 1 ? '' : 's'} from now)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="se-rows">
          <div className="se-row">
            <div className="se-row-label">Plan</div>
            <div className="se-row-val">Pro</div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Account panel
   ─────────────────────────────────────────────────────────── */

function AccountPanel() {
  const { signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    window.location.href = '/login';
  }

  return (
    <section className="se-panel">
      <div className="se-panel-h">Account</div>
      <div className="se-rows">
        <div className="se-row">
          <div className="se-row-label">Session</div>
          <button className="se-signout" type="button" onClick={handleSignOut}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 2.5H3.2c-.4 0-.7.3-.7.7v9.6c0 .4.3.7.7.7H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M9.5 5l3 3-3 3M12.5 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
      <p className="se-note">
        Account deletion is not yet self-serve. Email <a href="mailto:support@veralithai.com">support@veralithai.com</a> to delete your data.
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page
   ─────────────────────────────────────────────────────────── */

export default function Settings() {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
  });
  const me = meQuery.data;

  return (
    <ProjectShell variant="workspace" active="wsSettings">
      <div className="se-body">
        <SettingsSidebar active="profile" />
        <div className="se-main">
          <div className="se-content">
            <h1 className="se-title">Profile</h1>
            {meQuery.isLoading || !me ? (
              <p className="he-empty-line">Loading profile…</p>
            ) : meQuery.isError ? (
              <p className="he-empty-line">Failed to load profile.</p>
            ) : (
              <>
                <IdentityPanel me={me} />
                <PlanPanel me={me} />
                <AccountPanel />
              </>
            )}
          </div>
        </div>
      </div>
    </ProjectShell>
  );
}
