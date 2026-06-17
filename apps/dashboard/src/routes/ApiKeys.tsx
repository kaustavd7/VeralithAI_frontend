import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import { useApiKeys } from '../hooks/useOverviewData';
import { api } from '../api/client';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews';
import type { ApiKey, ApiKeyWithSecret } from '../api/types';
import '../styles/project-shell.css';
import '../styles/project-page.css';

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8.3 8H14M11.5 8v2.4M13.2 8v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* Project API keys — list, create (one-time secret reveal), revoke.
   Per-project; backend CRUD lives at /v1/projects/{id}/api-keys. */
export default function ApiKeys() {
  const { slug = '' } = useParams<{ slug: string }>();
  const projects = useProjects();
  const project = projects.data?.projects.find((p) => p.slug === slug || p.id === slug);
  const projectName = project?.name ?? slug;
  const queryClient = useQueryClient();

  const keysQuery = useApiKeys(slug);
  const keys = keysQuery.data?.api_keys ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [revealed, setRevealed] = useState<ApiKeyWithSecret | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmKey, setConfirmKey] = useState<ApiKey | null>(null);

  const createMut = useMutation({
    mutationFn: (name: string) =>
      api.createApiKey(slug, name.trim() ? { name: name.trim() } : {}),
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

  const hasKeys = keys.length > 0;

  return (
    <ProjectShell slug={slug} active="apiKeys" project={projectName}>
      <div className="po-page">
        <div
          className="page-header"
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
        >
          <div>
            <h1 className="page-title">API keys</h1>
            <div className="page-sub">
              Authenticate the SDK and ingest endpoints for <b>{projectName}</b>. Secrets are shown once,
              at creation.
            </div>
          </div>
          {hasKeys && (
            <button
              type="button"
              className="po-btn"
              onClick={() => {
                createMut.reset();
                setCreateOpen(true);
              }}
            >
              + Create key
            </button>
          )}
        </div>

        {keysQuery.isLoading ? (
          <LoadingState label="Loading API keys…" />
        ) : keysQuery.isError ? (
          <ErrorState
            message={keysQuery.error instanceof Error ? keysQuery.error.message : undefined}
            onRetry={() => keysQuery.refetch()}
          />
        ) : !hasKeys ? (
          <EmptyState
            title="No API keys yet"
            sub="Create a key to start sending traces from your RAG app via the Veralith SDK."
            action={
              <button type="button" className="po-btn" onClick={() => { createMut.reset(); setCreateOpen(true); }}>
                Create your first key
              </button>
            }
          />
        ) : (
          <div className="ak-card">
            <div className="ak-list">
              {keys.map((k) => {
                const revoked = k.revoked_at !== null;
                return (
                  <div key={k.id} className={'ak-row' + (revoked ? ' is-revoked' : '')}>
                    <div className="ak-key-ic"><KeyIcon /></div>
                    <div className="ak-main">
                      <div className="ak-titlerow">
                        <span className="ak-name">{k.name ?? 'default'}</span>
                      </div>
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
                        <span className="ak-revoked-pill">
                          Revoked {new Date(k.revoked_at!).toLocaleDateString()}
                        </span>
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
      </div>

      {/* Create modal */}
      {createOpen && (
        <div className="he-modal-scrim" onClick={() => setCreateOpen(false)}>
          <div className="he-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="he-modal-title">Create API key</div>
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
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'stretch' }}>
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
              <b>401</b> immediately. This cannot be undone — issue a new key first if you have running
              services.
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
    </ProjectShell>
  );
}
