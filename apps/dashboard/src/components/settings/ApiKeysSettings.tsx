import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjects } from '../../hooks/useProjects';
import { useApiKeys } from '../../hooks/useOverviewData';
import { api } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../StateViews';
import { Skel, SkelStatus } from '../Skeleton';
import { ByokKeyRow } from './ByokKeyRow';
import type { ApiKey, ApiKeyWithSecret, Project } from '../../api/types';

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8.3 8H14M11.5 8v2.4M13.2 8v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* One project's keys — list, create (one-time secret reveal), revoke. */
function ProjectKeysGroup({ project }: { project: Project }) {
  const slug = project.slug;
  const queryClient = useQueryClient();
  const keysQuery = useApiKeys(slug);
  const keys = keysQuery.data?.api_keys ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [revealed, setRevealed] = useState<ApiKeyWithSecret | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmKey, setConfirmKey] = useState<ApiKey | null>(null);

  const createMut = useMutation({
    mutationFn: (name: string) => api.createApiKey(slug, name.trim() ? { name: name.trim() } : {}),
    onSuccess: (res) => {
      setRevealed(res.api_key);
      setCreateOpen(false);
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys', slug] });
    },
  });
  const revokeMut = useMutation({
    mutationFn: (keyId: string) => api.deleteApiKey(slug, keyId),
    onSuccess: () => {
      setConfirmKey(null);
      queryClient.invalidateQueries({ queryKey: ['api-keys', slug] });
    },
  });

  async function copySecret() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still select the text */
    }
  }

  return (
    <section className="se-keys-group">
      <div className="se-keys-grouphead">
        <span className="se-keys-projname">{project.name}</span>
        <span className="se-keys-projslug po-mono">{project.slug}</span>
        <button
          type="button"
          className="po-btn po-btn-sm"
          onClick={() => { createMut.reset(); setCreateOpen(true); }}
        >
          + New key
        </button>
      </div>

      {keysQuery.isLoading ? (
        <LoadingState label="Loading keys…" />
      ) : keysQuery.isError ? (
        <ErrorState
          message={keysQuery.error instanceof Error ? keysQuery.error.message : undefined}
          onRetry={() => keysQuery.refetch()}
        />
      ) : keys.length === 0 ? (
        <div className="se-keys-empty">No keys for this project yet.</div>
      ) : (
        <div className="ak-card">
          <div className="ak-list">
            {keys.map((k) => {
              const revoked = k.revoked_at !== null;
              return (
                <div key={k.id} className={'ak-row' + (revoked ? ' is-revoked' : '')}>
                  <div className="ak-key-ic"><KeyIcon /></div>
                  <div className="ak-main">
                    <div className="ak-titlerow"><span className="ak-name">{k.name ?? 'default'}</span></div>
                    <div className="ak-meta">
                      <span className={'ak-prefix' + (revoked ? ' is-struck' : '')}>{k.prefix}</span>
                      <span className="he-dot-sep">·</span>
                      <span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                      {k.last_used_at && (
                        <>
                          <span className="he-dot-sep">·</span>
                          <span>Last used {new Date(k.last_used_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ak-action">
                    {revoked ? (
                      <span className="ak-revoked-pill">Revoked {new Date(k.revoked_at!).toLocaleDateString()}</span>
                    ) : (
                      <button
                        type="button"
                        className="ak-revoke"
                        onClick={() => setConfirmKey(k)}
                        disabled={revokeMut.isPending}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clearly separate the BYOK model key from the Veralith SDK keys above —
          they're both "keys" but do completely different jobs. */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--po-line)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--po-fg-2)' }}>
          Model provider key · bring your own
        </div>
        <div style={{ fontSize: 12, color: 'var(--po-fg-4)', marginTop: 3, maxWidth: '60ch' }}>
          Different from the Veralith keys above. Those authenticate the SDK; this is your
          own <b>LLM provider</b> key, which Veralith runs this project’s judges on — so
          evaluation bills your account, not ours.
        </div>
      </div>
      <ByokKeyRow project={project} />

      {/* Create modal */}
      {createOpen && (
        <div className="he-modal-scrim" onClick={() => setCreateOpen(false)}>
          <div className="he-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="he-modal-title">New key · {project.name}</div>
            <div className="he-modal-body">
              <label style={{ display: 'block', fontSize: 12, color: 'var(--po-fg-3)', marginBottom: 6 }}>
                Name (optional)
              </label>
              <input
                autoFocus
                className="se-input"
                style={{ width: '100%' }}
                placeholder="e.g. production"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !createMut.isPending) createMut.mutate(newName); }}
              />
              {createMut.isError && (
                <div style={{ marginTop: 8, color: 'var(--po-bad)', fontSize: 12.5 }}>
                  {createMut.error instanceof Error ? createMut.error.message : 'Could not create key.'}
                </div>
              )}
            </div>
            <div className="he-modal-actions">
              <button className="he-btn he-btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button
                className="he-btn he-btn-primary"
                onClick={() => createMut.mutate(newName)}
                disabled={createMut.isPending}
              >
                {createMut.isPending ? 'Creating…' : 'Create key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One-time secret reveal */}
      {revealed && (
        <div className="he-modal-scrim" onClick={() => setRevealed(null)}>
          <div className="he-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="he-modal-title">Your new API key</div>
            <div className="he-modal-body">
              Copy it now — for your security, <b>we won’t show the secret again.</b>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <code
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: 'var(--po-panel-2)',
                    border: '1px solid var(--po-line)',
                    borderRadius: 'var(--po-radius-sm)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12.5,
                    wordBreak: 'break-all',
                    color: 'var(--po-fg)',
                  }}
                >
                  {revealed.secret}
                </code>
                <button className="he-btn he-btn-ghost" onClick={copySecret} style={{ flex: '0 0 auto' }}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="he-modal-actions">
              <button className="he-btn he-btn-primary" onClick={() => setRevealed(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirm */}
      {confirmKey && (
        <div className="he-modal-scrim" onClick={() => setConfirmKey(null)}>
          <div className="he-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="he-modal-title">Revoke this API key?</div>
            <div className="he-modal-body">
              Requests using <span className="ak-modal-prefix">{confirmKey.prefix}…</span> will return{' '}
              <b>401</b> immediately. This cannot be undone — issue a new key first if you have running services.
              {revokeMut.isError && (
                <div style={{ marginTop: 8, color: 'var(--po-bad)', fontSize: 12.5 }}>
                  {revokeMut.error instanceof Error ? revokeMut.error.message : 'Could not revoke key.'}
                </div>
              )}
            </div>
            <div className="he-modal-actions">
              <button className="he-btn he-btn-ghost" onClick={() => setConfirmKey(null)}>Cancel</button>
              <button
                className="he-btn he-btn-danger"
                onClick={() => revokeMut.mutate(confirmKey.id)}
                disabled={revokeMut.isPending}
              >
                {revokeMut.isPending ? 'Revoking…' : 'Revoke key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* Layout-matched skeleton — mirrors the intro + per-project key groups so the
   swap to real content is shift-free (same wrappers, grids and row sizes). */
function ApiKeysSettingsSkeleton() {
  return (
    <>
      <SkelStatus label="Loading API keys…" />
      <p className="se-keys-intro">
        <Skel h={11} w="80%" style={{ display: 'block', marginBottom: 6 }} />
        <Skel h={11} w="55%" style={{ display: 'block' }} />
      </p>
      <div className="se-keys">
        {Array.from({ length: 2 }, (_, gi) => (
          <section className="se-keys-group" key={gi}>
            <div className="se-keys-grouphead">
              <Skel h={14} w={140} />
              <Skel h={11} w={90} />
              <Skel h={26} w={88} r={8} style={{ marginLeft: 'auto' }} />
            </div>
            <div className="ak-card">
              <div className="ak-list">
                {Array.from({ length: gi === 0 ? 2 : 1 }, (_, ri) => (
                  <div className="ak-row" key={ri}>
                    <div className="ak-key-ic"><Skel h={16} w={16} r={4} /></div>
                    <div className="ak-main">
                      <div className="ak-titlerow"><Skel h={14} w={120} /></div>
                      <div className="ak-meta" style={{ marginTop: 6 }}>
                        <Skel h={11} w={220} />
                      </div>
                    </div>
                    <div className="ak-action"><Skel h={14} w={56} /></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/* Cross-project API keys — a group per project. */
export function ApiKeysSettings() {
  const projects = useProjects();

  if (projects.isLoading) return <ApiKeysSettingsSkeleton />;
  if (projects.isError) {
    return (
      <ErrorState
        message={projects.error instanceof Error ? projects.error.message : 'Failed to load projects.'}
        onRetry={() => projects.refetch()}
      />
    );
  }
  const list = projects.data?.projects ?? [];
  if (list.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        sub="Create a project first — API keys are issued per project."
      />
    );
  }

  return (
    <>
      <p className="se-keys-intro">
        Keys authenticate the SDK and ingest endpoints. They’re scoped per project; secrets are shown once,
        at creation.
      </p>
      <div className="se-keys">
        {list.map((p) => (
          <ProjectKeysGroup key={p.id} project={p} />
        ))}
      </div>
    </>
  );
}
