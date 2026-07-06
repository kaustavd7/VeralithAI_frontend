import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
// po-card / po-conn styling — imported here so the cards render correctly
// wherever they're used (onboarding overview AND the global Workbench drawer).
import '../styles/project-page.css';

/* ─────────────────────────────────────────────────────────────
   ConnectCards — the first-run onboarding block, shown wherever a
   project has zero traces yet. Two stacked IDE-style cards:

     Step 1 · Connect your SDK      → get traces flowing in
     Step 2 · Connect your agent    → let a coding agent heal them

   Self-contained (its own tiny tokenizer + code surface) so it can
   drop into any empty state. The MCP snippets prefer the
   ${VERALITH_API_KEY} env indirection so the key stays single-source
   — the same var the SDK reads.
   ─────────────────────────────────────────────────────────── */

const MCP_URL = 'https://api.veralithai.com/mcp/http';

// ── tiny syntax tokenizer ──────────────────────────────────────────────────
type TokKind = 'cmt' | 'kw' | 'str' | 'fn' | 'num' | 'punct' | 'plain';
type Tok = { t: string; k: TokKind };
type CodeLine = Tok[];
const tk = (t: string, k: TokKind = 'plain'): Tok => ({ t, k });

const TOK_COLOR: Record<TokKind, string> = {
  cmt: '#6b7689',
  kw: '#c792ea',
  str: '#9ad8a0',
  fn: '#79b8ff',
  num: '#f2a96b',
  punct: '#8b94a3',
  plain: '#cdd4df',
};

function plainCopy(lines: CodeLine[]): string {
  return lines.map((line) => line.map((t) => t.t).join('')).join('\n');
}

// ── SDK (ingestion) snippets ───────────────────────────────────────────────
type Lang = 'python' | 'node' | 'curl';

function sdkFileName(lang: Lang): string {
  if (lang === 'python') return 'rag_pipeline.py';
  if (lang === 'node') return 'trace.js';
  return 'send_trace.sh';
}

function sdkSnippet(lang: Lang, key: string): CodeLine[] {
  if (lang === 'python') {
    return [
      [tk('# 1. install', 'cmt')],
      [tk('pip', 'fn'), tk(' install veralith')],
      [],
      [tk('# 2. export your project key', 'cmt')],
      [tk('export', 'kw'), tk(' VERALITH_API_KEY='), tk(`"${key}"`, 'str')],
      [],
      [tk('# 3. log one trace from your RAG pipeline', 'cmt')],
      [tk('import', 'kw'), tk(' veralith', 'fn')],
      [],
      [tk('trace_id = veralith.'), tk('log', 'fn'), tk('(')],
      [tk('    query'), tk('='), tk('"What is the Rule of 72?"', 'str'), tk(',')],
      [tk('    context'), tk('=['), tk('"Divide 72 by the annual rate…"', 'str'), tk('],')],
      [tk('    response'), tk('='), tk('"At 8%, money doubles in ~9 years."', 'str'), tk(',')],
      [tk(')')],
    ];
  }
  if (lang === 'node') {
    return [
      [tk('// No node SDK — POST a trace to the REST API.', 'cmt')],
      [tk('await', 'kw'), tk(' '), tk('fetch', 'fn'), tk('('), tk('"https://api.veralithai.com/v1/traces"', 'str'), tk(', {')],
      [tk('  method'), tk(': '), tk('"POST"', 'str'), tk(',')],
      [tk('  headers'), tk(': {')],
      [tk('    '), tk('"Authorization"', 'str'), tk(': '), tk(`"Bearer ${key}"`, 'str'), tk(',')],
      [tk('    '), tk('"Content-Type"', 'str'), tk(': '), tk('"application/json"', 'str'), tk(',')],
      [tk('  },')],
      [tk('  body'), tk(': '), tk('JSON', 'fn'), tk('.'), tk('stringify', 'fn'), tk('({')],
      [tk('    query'), tk(': '), tk('"What is the Rule of 72?"', 'str'), tk(',')],
      [tk('    response'), tk(': '), tk('"At 8%, money doubles in ~9 years."', 'str'), tk(',')],
      [tk('    retrieved_chunks'), tk(': ['), tk('"Divide 72 by the annual rate…"', 'str'), tk('],')],
      [tk('  }),')],
      [tk('});')],
    ];
  }
  return [
    [tk('# POST a trace to the REST API', 'cmt')],
    [tk('curl', 'fn'), tk(' -X POST https://api.veralithai.com/v1/traces \\')],
    [tk('  -H '), tk(`"Authorization: Bearer ${key}"`, 'str'), tk(' \\')],
    [tk('  -H '), tk('"Content-Type: application/json"', 'str'), tk(' \\')],
    [tk("  -d '{")],
    [tk('    '), tk('"query"', 'str'), tk(': '), tk('"What is the Rule of 72?"', 'str'), tk(',')],
    [tk('    '), tk('"response"', 'str'), tk(': '), tk('"At 8%, money doubles in ~9 years."', 'str'), tk(',')],
    [tk('    '), tk('"retrieved_chunks"', 'str'), tk(': ['), tk('"Divide 72 by the annual rate…"', 'str'), tk(']')],
    [tk("  }'")],
  ];
}

// ── MCP (agent) snippets ───────────────────────────────────────────────────
type McpClient = 'claude' | 'cursor' | 'codex';

function mcpFileName(c: McpClient): string {
  if (c === 'claude') return '.mcp.json';
  if (c === 'cursor') return '.cursor/mcp.json';
  return '~/.codex/config.toml';
}

function mcpSnippet(c: McpClient, key: string): CodeLine[] {
  if (c === 'claude') {
    return [
      [tk('{')],
      [tk('  '), tk('"mcpServers"', 'str'), tk(': {')],
      [tk('    '), tk('"veralith"', 'str'), tk(': {')],
      [tk('      '), tk('"type"', 'str'), tk(': '), tk('"http"', 'str'), tk(',')],
      [tk('      '), tk('"url"', 'str'), tk(': '), tk(`"${MCP_URL}"`, 'str'), tk(',')],
      [tk('      '), tk('"headers"', 'str'), tk(': { '), tk('"Authorization"', 'str'), tk(': '), tk(`"Bearer ${key}"`, 'str'), tk(' }')],
      [tk('    }')],
      [tk('  }')],
      [tk('}')],
    ];
  }
  if (c === 'cursor') {
    return [
      [tk('{')],
      [tk('  '), tk('"mcpServers"', 'str'), tk(': {')],
      [tk('    '), tk('"veralith"', 'str'), tk(': {')],
      [tk('      '), tk('"type"', 'str'), tk(': '), tk('"streamableHttp"', 'str'), tk(',')],
      [tk('      '), tk('"url"', 'str'), tk(': '), tk(`"${MCP_URL}"`, 'str'), tk(',')],
      [tk('      '), tk('"headers"', 'str'), tk(': { '), tk('"Authorization"', 'str'), tk(': '), tk(`"Bearer ${key}"`, 'str'), tk(' }')],
      [tk('    }')],
      [tk('  }')],
      [tk('}')],
    ];
  }
  return [
    [tk('[mcp_servers.veralith]', 'fn')],
    [tk('url'), tk(' = '), tk(`"${MCP_URL}"`, 'str')],
    [tk('bearer_token_env_var'), tk(' = '), tk('"VERALITH_API_KEY"', 'str')],
    [],
    [tk('# reads the same key env var as the SDK', 'cmt')],
  ];
}

/** Claude Code's `claude mcp add` one-liner — the no-file alternative to editing
    .mcp.json. Key is baked in (prefilled) for copy-paste-run. */
function claudeCliSnippet(key: string): CodeLine[] {
  return [
    [tk('# one command — registers the veralith MCP server', 'cmt')],
    [tk('claude', 'fn'), tk(' mcp add --transport http veralith \\')],
    [tk('  '), tk(`${MCP_URL} \\`)],
    [tk('  --header '), tk(`"Authorization: Bearer ${key}"`, 'str')],
  ];
}

// ── shared rendering pieces ─────────────────────────────────────────────────
function CodeBlock({ lines }: { lines: CodeLine[] }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: '14px 16px 16px',
        background: 'transparent',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12.5,
        lineHeight: 1.7,
        color: TOK_COLOR.plain,
        overflowX: 'auto',
        whiteSpace: 'pre',
        tabSize: 2,
      }}
    >
      <code>
        {lines.map((line, i) => (
          <span key={i} style={{ display: 'block', minHeight: '1.7em' }}>
            {line.map((seg, j) => (
              <span key={j} style={{ color: TOK_COLOR[seg.k] }}>{seg.t}</span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  );
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — user can still select the text */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy snippet"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px',
        fontFamily: MONO, fontSize: 11.5, color: copied ? 'var(--po-live)' : '#9aa3b2',
        background: '#0d1117', border: '1px solid #1c2430', borderRadius: 6, cursor: 'pointer',
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.5 3.5V2.5a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H9.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
          copy
        </>
      )}
    </button>
  );
}

/* One IDE card: window chrome + tabs + code surface. Generic over its tab id. */
function IdeCard<T extends string>({
  title, sub, badge, connected, connectedLabel, tabs, active, onTab, fileName, lines, footer, rightSlot,
}: {
  title: string;
  sub: string;
  badge: string;
  connected: boolean;
  connectedLabel: string;
  tabs: { id: T; label: string }[];
  active: T;
  onTab: (id: T) => void;
  fileName: string;
  lines: CodeLine[];
  footer: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="po-card po-conn po-conn-never" style={{ overflow: 'hidden', padding: 0 }}>
      <div className="po-card-head" style={{ padding: 'var(--card-pad)', marginBottom: 0 }}>
        <div>
          <div className="po-card-title">{title}</div>
          <div className="po-card-sub">{sub}</div>
        </div>
        <div className="po-conn-state">
          {connected ? (
            <>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill="var(--po-live)" />
                <path d="M4.7 8.2l2.1 2.1 4.5-4.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="po-conn-state-label" style={{ color: 'var(--po-live)' }}>{connectedLabel}</span>
            </>
          ) : (
            <>
              <span className="po-dot po-dot-grey" />
              <span className="po-conn-state-label">{badge}</span>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          margin: '0 var(--space-6) var(--space-4)',
          borderRadius: 'var(--po-radius-sm)',
          border: '1px solid #1c2430',
          background: '#0d1117',
          overflow: 'hidden',
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.32)',
        }}
      >
        {/* window chrome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 38, padding: '0 12px', background: '#11161f', borderBottom: '1px solid #1c2430' }}>
          <span style={{ display: 'flex', gap: 7 }} aria-hidden="true">
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: '#8b94a3', padding: '4px 10px', borderRadius: 5, background: '#0d1117', border: '1px solid #1c2430' }}>
            {fileName}
          </span>
          <span style={{ flex: 1 }} />
          <CopyBtn text={plainCopy(lines)} />
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', background: '#0f141c', borderBottom: '1px solid #1c2430' }}>
          {tabs.map(({ id, label }) => {
            const on = id === active;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                style={{
                  appearance: 'none', border: 'none', background: 'transparent', padding: '9px 12px 8px',
                  fontFamily: MONO, fontSize: 12, color: on ? '#e6edf3' : '#6b7689',
                  borderBottom: on ? '2px solid var(--po-live)' : '2px solid transparent',
                  cursor: 'pointer', letterSpacing: 0.2,
                }}
              >
                {label}
              </button>
            );
          })}
          {rightSlot && (
            <>
              <span style={{ flex: 1 }} />
              {rightSlot}
            </>
          )}
        </div>

        <CodeBlock lines={lines} />
      </div>

      <div style={{ padding: '0 var(--space-6) var(--space-6)', fontSize: 12.5, color: 'var(--po-fg-3)', lineHeight: 1.65 }}>
        {footer}
      </div>
    </div>
  );
}

/* Explains the "prefilled key is incomplete" situation and lets the user
   reveal a real, full key inline (shown once). */
function KeyBanner({
  apiKey, revealed, onCreate, creating, error,
}: {
  apiKey: string | null;
  revealed: string | null;
  onCreate: () => void;
  creating: boolean;
  error: boolean;
}) {
  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, flexWrap: 'wrap', padding: '9px 13px',
    borderRadius: 'var(--po-radius-sm)', fontSize: 12.5, lineHeight: 1.5,
  };
  if (revealed) {
    return (
      <div style={{ ...base, border: '1px solid color-mix(in oklab, var(--po-live) 45%, transparent)', background: 'color-mix(in oklab, var(--po-live) 8%, transparent)', color: 'var(--po-fg-2)' }}>
        <span>
          <b style={{ color: 'var(--po-live)' }}>New key created and prefilled below.</b>{' '}
          It's shown only once — copy a snippet now; you won't see the full key again.
        </span>
      </div>
    );
  }
  return (
    <div style={{ ...base, border: '1px solid var(--po-line)', background: 'var(--po-panel-2)', color: 'var(--po-fg-3)' }}>
      <span>
        Snippets need your <b style={{ color: 'var(--po-fg-2)' }}>full</b> API key, shown only once at creation
        {apiKey ? <> (this project's key starts <code className="po-mono">{apiKey}…</code>)</> : null}. Paste yours into the
        snippet, or reveal a fresh one:
        {error ? <span style={{ color: 'var(--po-bad)' }}> · couldn't create — try again.</span> : null}
      </span>
      <button type="button" className="po-btn po-btn-sm" onClick={onCreate} disabled={creating}>
        {creating ? 'Creating…' : 'Create & reveal a key'}
      </button>
    </div>
  );
}

export function ConnectCards({ apiKey, slug }: { apiKey: string | null; slug: string }) {
  const qc = useQueryClient();
  // The full secret is only ever shown once, at creation. If the user reveals a
  // fresh key here we hold it and prefill the snippets with the REAL key;
  // otherwise we show a clear placeholder (never a truncated real prefix, which
  // looks broken).
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const createKey = useMutation({
    mutationFn: () => api.createApiKey(slug, { name: 'connect' }),
    onSuccess: (res) => {
      setRevealedKey(res.api_key.secret);
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
  const key = revealedKey ?? 'vk_live_YOUR_KEY';

  const [lang, setLang] = useState<Lang>('python');
  const [client, setClient] = useState<McpClient>('claude');
  // Claude Code offers two equivalent setups: a `claude mcp add` one-liner, or
  // an .mcp.json file. Show both (toggle), prefilled.
  const [claudeMode, setClaudeMode] = useState<'cli' | 'file'>('cli');

  const isClaude = client === 'claude';
  const mcpFile = isClaude ? (claudeMode === 'cli' ? 'terminal' : '.mcp.json') : mcpFileName(client);
  const mcpLines = isClaude
    ? (claudeMode === 'cli' ? claudeCliSnippet(key) : mcpSnippet('claude', key))
    : mcpSnippet(client, key);
  const claudeToggle = isClaude ? (
    <div style={{ display: 'inline-flex', gap: 2, alignItems: 'center', paddingBottom: 4 }}>
      {(['cli', 'file'] as const).map((m) => {
        const on = m === claudeMode;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setClaudeMode(m)}
            style={{
              appearance: 'none', border: '1px solid ' + (on ? '#2b3542' : 'transparent'),
              background: on ? '#1c2430' : 'transparent', color: on ? '#e6edf3' : '#6b7689',
              fontFamily: MONO, fontSize: 11, padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
            }}
          >
            {m === 'cli' ? 'CLI' : '.mcp.json'}
          </button>
        );
      })}
    </div>
  ) : undefined;

  // Live wiring status — polls every 5s so each step flips to a green check the
  // moment the SDK sends its first trace / the agent first authenticates.
  const conn = useQuery({
    queryKey: ['connection', slug],
    queryFn: () => api.getConnectionStatus(slug),
    enabled: !!slug,
    refetchInterval: 5000,
  });
  const sdkOn = conn.data?.sdk_connected ?? false;
  const mcpOn = conn.data?.mcp_connected ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <KeyBanner
        apiKey={apiKey}
        revealed={revealedKey}
        onCreate={() => createKey.mutate()}
        creating={createKey.isPending}
        error={createKey.isError}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
      >
      <IdeCard<Lang>
        title="Step 1 · Connect your SDK"
        sub="One line in your RAG pipeline starts the trace stream"
        badge="Waiting for first trace"
        connected={sdkOn}
        connectedLabel="Receiving traces"
        tabs={[{ id: 'python', label: 'python' }, { id: 'node', label: 'node' }, { id: 'curl', label: 'curl' }]}
        active={lang}
        onTab={setLang}
        fileName={sdkFileName(lang)}
        lines={sdkSnippet(lang, key)}
        footer={
          <>
            Run a few queries — failing ones become <b style={{ color: 'var(--po-fg-2)' }}>heal cards</b> automatically.
            This page updates the moment your first trace lands.
          </>
        }
      />
      <IdeCard<McpClient>
        title="Step 2 · Connect your coding agent"
        sub="So your agent can read heal cards and open fix PRs (optional)"
        badge="Optional"
        connected={mcpOn}
        connectedLabel="Agent connected"
        tabs={[{ id: 'claude', label: 'Claude Code' }, { id: 'cursor', label: 'Cursor' }, { id: 'codex', label: 'Codex' }]}
        active={client}
        onTab={setClient}
        fileName={mcpFile}
        lines={mcpLines}
        rightSlot={claudeToggle}
        footer={
          <>
            {isClaude && claudeMode === 'cli' ? (
              <>Run it in your project, then <code className="po-mono">/mcp</code> should list <b style={{ color: 'var(--po-fg-2)' }}>veralith</b>.</>
            ) : (
              <>Save the file, reload your agent, then run <code className="po-mono">/mcp</code> to confirm <b style={{ color: 'var(--po-fg-2)' }}>veralith</b> is connected.</>
            )}{' '}
            The key is prefilled above.
          </>
        }
      />
      </div>
    </div>
  );
}
