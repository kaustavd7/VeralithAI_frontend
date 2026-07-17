import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Project } from '../../api/types';

function OpenAiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.6 13.2 4.6v6L8 13.6 2.8 10.6v-6L8 1.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 6.2v4.2M5.6 7.4 8 6.2l2.4 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * BYOK — the project's own OpenAI key.
 *
 * When set, Veralith runs this project's judges (Sufficiency / Faithfulness /
 * Completeness) on the customer's key, so evaluation bills their OpenAI account
 * instead of ours. Heal cards still run on Veralith's key (that's the paid part).
 *
 * The key is write-only: we store it encrypted and only ever read back a
 * `…last4` hint, so it can never be displayed again after saving.
 */
export function ByokKeyRow({ project }: { project: Project }) {
  const slug = project.slug;
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['byok-key', slug],
    queryFn: () => api.getByokKey(slug),
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const saveMut = useMutation({
    mutationFn: (key: string) => api.setByokKey(slug, key.trim()),
    onSuccess: () => {
      setEditing(false);
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['byok-key', slug] });
    },
  });
  const clearMut = useMutation({
    mutationFn: () => api.clearByokKey(slug),
    onSuccess: () => {
      setConfirmClear(false);
      queryClient.invalidateQueries({ queryKey: ['byok-key', slug] });
    },
  });

  const status = statusQuery.data;
  const configured = status?.configured ?? false;

  return (
    <div className="ak-card" style={{ marginTop: 10 }}>
      <div className="ak-row">
        <div className="ak-key-ic"><OpenAiIcon /></div>
        <div className="ak-main">
          <div className="ak-titlerow">
            <span className="ak-name">Your OpenAI key</span>
            {configured && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: 'var(--accent)',
                  background: 'color-mix(in oklab, var(--accent) 14%, transparent)',
                  border: '1px solid color-mix(in oklab, var(--accent) 32%, transparent)',
                  padding: '1px 7px',
                  borderRadius: 999,
                }}
              >
                in use
              </span>
            )}
          </div>
          <div className="ak-meta">
            {statusQuery.isLoading ? (
              <span>Checking…</span>
            ) : configured ? (
              <>
                <span className="ak-prefix">sk-…{(status?.hint ?? '').replace('…', '')}</span>
                <span className="he-dot-sep">·</span>
                <span>Judges run on your key — evaluation bills your OpenAI account.</span>
              </>
            ) : (
              <span>
                Not set — judges currently run on Veralith’s key. Add your own to bill your
                OpenAI account directly.
              </span>
            )}
          </div>
        </div>
        <div className="ak-action" style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="po-btn po-btn-sm"
            onClick={() => { saveMut.reset(); setDraft(''); setEditing(true); }}
          >
            {configured ? 'Replace' : 'Add key'}
          </button>
          {configured && (
            <button
              type="button"
              className="ak-revoke"
              onClick={() => setConfirmClear(true)}
              disabled={clearMut.isPending}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Add / replace */}
      {editing && (
        <div className="he-modal-scrim" onClick={() => setEditing(false)}>
          <div className="he-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="he-modal-title">
              {configured ? 'Replace' : 'Add'} OpenAI key · {project.name}
            </div>
            <div className="he-modal-body">
              Veralith will run this project’s judges on this key, so evaluation bills your
              OpenAI account. We store it encrypted and never show it again.
              <input
                autoFocus
                type="password"
                className="se-input"
                style={{ width: '100%', marginTop: 12, fontFamily: 'var(--font-mono)' }}
                placeholder="sk-proj-…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draft.trim() && !saveMut.isPending) saveMut.mutate(draft);
                }}
              />
              {saveMut.isError && (
                <div style={{ marginTop: 8, color: 'var(--po-bad)', fontSize: 12.5 }}>
                  {saveMut.error instanceof Error
                    ? saveMut.error.message
                    : 'Could not save the key.'}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--po-fg-4)' }}>
                We verify the key with OpenAI before saving.
              </div>
            </div>
            <div className="he-modal-actions">
              <button className="he-btn he-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button
                className="he-btn he-btn-primary"
                onClick={() => saveMut.mutate(draft)}
                disabled={!draft.trim() || saveMut.isPending}
              >
                {saveMut.isPending ? 'Verifying…' : 'Save key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm removal */}
      {confirmClear && (
        <div className="he-modal-scrim" onClick={() => setConfirmClear(false)}>
          <div className="he-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="he-modal-title">Remove your OpenAI key?</div>
            <div className="he-modal-body">
              Judges for <b>{project.name}</b> will go back to running on Veralith’s key.
              Your existing traces and diagnoses are unaffected.
            </div>
            <div className="he-modal-actions">
              <button className="he-btn he-btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button
                className="he-btn he-btn-danger"
                onClick={() => clearMut.mutate()}
                disabled={clearMut.isPending}
              >
                {clearMut.isPending ? 'Removing…' : 'Remove key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
