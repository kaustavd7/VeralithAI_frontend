import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Project, ApiKeyWithSecret } from '../api/types';
import { useAuth } from '../hooks/useAuth';

type Step =
  | { kind: 'create-project' }
  | { kind: 'show-key'; project: Project; apiKey: ApiKeyWithSecret };

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>({ kind: 'create-project' });
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user already has projects, skip onboarding entirely.
  useEffect(() => {
    if (authLoading || !user) return;
    api
      .listProjects()
      .then(({ projects }) => {
        if (projects.length > 0) {
          navigate(`/projects/${projects[0].slug}`, { replace: true });
        }
      })
      .catch(() => {
        // Ignore — user can still create a new project.
      });
  }, [authLoading, user, navigate]);

  async function onCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { project } = await api.createProject({ name });
      const { api_key } = await api.createApiKey(project.id, { name: 'default' });
      setStep({ kind: 'show-key', project, apiKey: api_key });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

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
          maxWidth: 560,
          padding: '40px',
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

        {step.kind === 'create-project' ? (
          <CreateProjectStep
            name={name}
            onNameChange={setName}
            submitting={submitting}
            error={error}
            onSubmit={onCreateProject}
          />
        ) : (
          <ShowKeyStep
            project={step.project}
            apiKey={step.apiKey}
            onContinue={() => navigate(`/projects/${step.project.slug}`)}
          />
        )}
      </div>
    </main>
  );
}

function CreateProjectStep({
  name,
  onNameChange,
  submitting,
  error,
  onSubmit,
}: {
  name: string;
  onNameChange: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <h1 style={{ margin: '0 0 12px 0', fontSize: 26, fontWeight: 600 }}>Welcome to Veralith</h1>
      <p style={{ margin: '0 0 28px 0', color: 'var(--fg-3)', lineHeight: 1.6 }}>
        Let&apos;s create your first project. A project is one RAG application you want to
        monitor.
      </p>

      <form onSubmit={onSubmit}>
        <label
          htmlFor="project-name"
          style={{
            display: 'block',
            fontSize: 13,
            color: 'var(--fg-2)',
            marginBottom: 8,
          }}
        >
          Project name
        </label>
        <input
          id="project-name"
          type="text"
          required
          autoFocus
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="my-rag-app"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--bg)',
            color: 'var(--fg)',
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            outline: 'none',
          }}
        />

        {error ? (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: 'rgba(226, 92, 92, 0.1)',
              border: '1px solid rgba(226, 92, 92, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--cell-cu)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            style={{
              padding: '10px 18px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: 14,
              cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !name.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? 'Creating…' : 'Create project →'}
          </button>
        </div>
      </form>
    </>
  );
}

function ShowKeyStep({
  project,
  apiKey,
  onContinue,
}: {
  project: Project;
  apiKey: ApiKeyWithSecret;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(apiKey.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked — user can still select and copy
    }
  }

  const snippet = `import veralith

veralith.configure(api_key="${apiKey.secret}")

@veralith.trace
def my_rag(query):
    chunks = retrieve(query)
    answer = generate(query, chunks)
    return answer, chunks`;

  return (
    <>
      <h1 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 600 }}>
        Here&apos;s your API key for{' '}
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
          {project.name}
        </span>
      </h1>
      <p style={{ margin: '0 0 24px 0', color: 'var(--fg-3)', fontSize: 13 }}>
        This is the only time the full key will be shown. Copy it somewhere safe.
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          background: 'var(--bg)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 24,
        }}
      >
        <code
          style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--fg)',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {apiKey.secret}
        </code>
        <button
          type="button"
          onClick={copyKey}
          style={{
            padding: '6px 12px',
            background: copied ? 'var(--accent-dim)' : 'var(--panel-3)',
            color: copied ? 'var(--accent)' : 'var(--fg-2)',
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p style={{ margin: '0 0 8px 0', color: 'var(--fg-2)', fontSize: 13 }}>
        Add this to your Python RAG code:
      </p>

      <pre
        style={{
          margin: '0 0 24px 0',
          padding: '16px',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--fg-2)',
          overflowX: 'auto',
        }}
      >
        {snippet}
      </pre>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onContinue}
          style={{
            padding: '10px 18px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          I&apos;ve copied it, take me to the dashboard →
        </button>
      </div>
    </>
  );
}
