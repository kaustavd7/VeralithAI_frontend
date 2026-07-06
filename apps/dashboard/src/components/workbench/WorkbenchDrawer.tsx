import { useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { SHELL_CATALOG, methodById, type ShellMethod, type ShellParam } from './shellCatalog';
// The Workbench's `.wb-*` styles live in today-workbench.css. Import them here so
// they're always bundled — TodayOverview (the former importer) is now unrouted.
import '../../styles/today-workbench.css';
import { supabase } from '../../lib/supabase';
import { useProjects } from '../../hooks/useProjects';
import { useApiKeys, useStats, useSystemHealth } from '../../hooks/useOverviewData';
import { useEventLog } from '../../lib/eventLog';
import { onOpenWorkbench } from '../../lib/workbench';
import { ConnectCards } from '../ConnectCards';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';
const FETCH_BASE = import.meta.env.VITE_API_URL ?? '';
const LINK_RESET = { background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left' as const };

/* Resolve the project the Workbench acts on: the one in the URL, else the first
   project (the drawer is global and also shows on pages without a :slug). */
function useCurrentProject(): { slug: string; id: string } {
  const exact = useMatch('/projects/:slug');
  const nested = useMatch('/projects/:slug/*');
  const projects = useProjects();
  const slug = nested?.params.slug ?? exact?.params.slug ?? projects.data?.projects[0]?.slug ?? '';
  const id =
    projects.data?.projects.find((p) => p.slug === slug || p.id === slug)?.id ??
    projects.data?.projects[0]?.id ??
    '';
  return { slug, id };
}

/* In live mode, default any `project_id` param to the current project's real id. */
function defaultParamVal(p: ShellParam, projectId: string): string {
  if (p.name === 'project_id' && projectId && !USE_MOCK) return projectId;
  return p.example;
}

/* Workbench — Stripe-Workbench-style bottom drawer, re-pointed at traces /
   judges / scores. Persistent, pinned to the bottom of the content frame;
   collapses to a one-line footer strip. Demo data for now — wire to the
   backend (SSE events, /traces, /stats, API keys) later. */

const WB_TABS = ['Integration', 'Logs', 'Health', 'Shell'] as const;
type WbTab = (typeof WB_TABS)[number];

const WB_DEFAULT_H = 432; // resting panel height
const WB_MIN_H = 300;     // smallest the panel can be dragged (keeps tab chrome + a usable body)
const WB_TOP_GAP = 96;    // keep the panel clear of the topbar when dragged tall

/* terminal-prompt mark used as the panel/strip brand */
function WbLogo() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 7.4 L8.6 10 L5.8 12.6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.4 13 H14.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WbHeader({
  active,
  onTab,
  onClose,
}: {
  active: WbTab;
  onTab: (t: WbTab) => void;
  onClose: () => void;
}) {
  return (
    <div className="wb-head">
      <span className="wb-title"><WbLogo /> For the Geeks</span>
      <nav className="wb-tabs">
        {WB_TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={'wb-tab' + (t === active ? ' is-active' : '')}
            onClick={() => onTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="wb-head-icons">
        <button type="button" className="wb-hicon" aria-label="Collapse" title="Collapse" onClick={onClose}><span aria-hidden="true">×</span></button>
      </div>
    </div>
  );
}

/* ── Integration — API keys + SDK quick-start + developer resources ─── */

const RESOURCES: [string, string, string][] = [
  ['Developer quick start', 'Send your first trace in 5 min', 'https://docs.veralithai.com/getting-started/quickstart'],
  ['Documentation', 'SDK, judges, failure cells', 'https://docs.veralithai.com'],
  ['API reference', 'Endpoints + schema', 'https://docs.veralithai.com/reference/rest-api'],
  ['Code samples', 'RAG, agents, batch eval', 'https://docs.veralithai.com/integration/recipes'],
];

function WbIntegration({ slug, projectId, onTab, onManageKeys }: { slug: string; projectId: string; onTab: (t: WbTab) => void; onManageKeys: () => void }) {
  const stats = useStats(slug, {}, { refetchInterval: 30_000 });
  const conn = stats.data?.connection_state;
  const sdkV = stats.data?.sdk_version;
  const apiKeys = useApiKeys(projectId);
  const activeKeys = (apiKeys.data?.api_keys ?? []).filter((k) => !k.revoked_at);
  const keyPrefix = activeKeys[0]?.prefix ?? apiKeys.data?.api_keys?.[0]?.prefix ?? null;
  const statusEl =
    conn === 'live' ? (
      <span className="wf-mlabel"><span className="po-dot po-dot-live" /> receiving traces · live</span>
    ) : conn === 'idle' ? (
      <span className="wf-mlabel"><span className="po-dot po-dot-idle" /> connected · no recent traces</span>
    ) : conn === 'never' ? (
      <span className="wf-mlabel"><span className="po-dot po-dot-idle" /> no traces yet</span>
    ) : (
      <span className="wf-mlabel"><span className="po-dot po-dot-idle" /> —</span>
    );
  return (
    <div className="wb-body wb-overview">
      <div className="wb-ov-main">
        <div className="wb-ov-head">
          <span className="wb-ov-title">Connect your project</span>
          {statusEl}
        </div>

        <div className="wb-int-block">
          <div className="wb-int-block-head">
            <span className="wb-int-block-t">API keys</span>
            <button type="button" className="wf-rec-link" style={LINK_RESET} onClick={onManageKeys}>Manage API keys →</button>
          </div>
          <div className="wb-int-keynote">
            {apiKeys.isLoading ? (
              'Checking your API keys…'
            ) : activeKeys.length > 0 ? (
              <>This project has <b>{activeKeys.length}</b> active API key{activeKeys.length === 1 ? '' : 's'}. Keys are shown only once at creation — rotate or revoke them in Settings.</>
            ) : (
              <>No API key on this project yet — create one in Settings. It's shown <b>once</b> at creation and can't be displayed again.</>
            )}
          </div>
        </div>

        {/* The two setup steps - SDK (traces in) + coding agent (MCP). Live green
            checks; Claude Code shows both the CLI and the .mcp.json, prefilled. */}
        <ConnectCards apiKey={keyPrefix} slug={slug} />
      </div>

      <aside className="wb-testing">
        <div className="wb-testing-head"><span>Developer tools</span></div>
        <button type="button" className="wf-rec-link" style={LINK_RESET} onClick={() => onTab('Shell')}>Send a test trace →</button>
        <div className="wb-int-meta">
          <span className="po-mono">SDK {sdkV ? 'v' + sdkV : '—'}</span><span className="wb-int-dot">·</span><span className="po-mono">{slug || 'no project'}</span>
        </div>
        <div className="wb-testing-sep" />
        <div className="wb-testing-head"><span>Developer resources</span></div>
        <div className="wb-res-links">
          {RESOURCES.map(([t, d, url]) => (
            <a className="wb-res-link2" key={t} href={url} target="_blank" rel="noreferrer">
              <span className="wb-res-link2-l">{t}<span className="wb-res-link2-d">{d}</span></span>
              <span className="wb-res-ext">↗</span>
            </a>
          ))}
        </div>
      </aside>
    </div>
  );
}

/* ── Shell — hybrid console: exercise Veralith's API + VQL + NL ──────────
   Left = a console (command echo + JSON / table output); right = a contextual
   Explorer (API request builder, or a VQL/NL cheatsheet). API calls resolve
   against the grounded demo catalog in ./shellCatalog; write/operate methods
   gate behind a confirm step. Wire to live `fetch` later inside execApi(). */

const SHELL_ROWS: [string, number, number, string, string][] = [
  ['t_9af3…2b', 0.12, 0.40, 'iu', '2.4s'],
  ['t_71cd…8e', 0.21, 0.55, 'cu', '1.9s'],
  ['t_0b6a…f1', 0.28, 0.61, 'ig', '1.2s'],
  ['t_4ea8…72', 0.34, 0.70, 'eg', '0.9s'],
  ['t_c9bf…57', 0.41, 0.66, 'cu', '1.6s'],
  ['t_2d10…aa', 0.47, 0.72, 'ig', '1.1s'],
  ['t_88f1…0c', 0.52, 0.69, 'eu', '2.0s'],
  ['t_1bd4…39', 0.58, 0.74, 'cg', '0.8s'],
  ['t_6e22…b7', 0.60, 0.63, 'cu', '1.4s'],
  ['t_a0f5…1d', 0.63, 0.81, 'cg', '0.7s'],
  ['t_3c77…e2', 0.66, 0.58, 'eu', '2.2s'],
  ['t_9d18…4f', 0.71, 0.77, 'ig', '1.0s'],
];

const DEFAULT_VQL = 'SELECT trace, sufficiency, faithfulness, cell FROM traces WHERE bucket = today ORDER BY sufficiency ASC LIMIT 20';
const DEFAULT_NL = "show today's lowest-sufficiency traces";
const VQL_SCHEMA: [string, string][] = [
  ['traces', 'trace, query, sufficiency, faithfulness, cell, latency, created_at'],
  ['stats', 'window, total, healthy_rate, by_cell'],
  ['heals', 'card, status, n_traces, slug'],
];
const VQL_EXAMPLES = [
  'SELECT trace, sufficiency, cell FROM traces WHERE cell = "iu" ORDER BY sufficiency ASC LIMIT 20',
  'SELECT cell, count(*) FROM traces WHERE bucket = today GROUP BY cell',
  'SELECT trace, faithfulness FROM traces WHERE faithfulness < 0.7',
];
const NL_EXAMPLES = [
  "show today's lowest-sufficiency traces",
  'which failure cell grew the most this week?',
  'list ungrounded answers about refunds',
];

type ShellMode = 'API' | 'VQL' | 'NL';
type SnippetLang = 'python' | 'node' | 'curl';
type ConsoleEntry =
  | { kind: 'api'; command: string; http: string; path: string; status: string; ok: boolean; body: unknown }
  | { kind: 'table'; command: string; note?: string }
  | { kind: 'error'; command: string; message: string }
  | { kind: 'info'; command: string; message: string };

const API_BASE = 'https://api.veralithai.com';

/* compact CLI form for the console echo — path + query params only (the body
   travels in the request body, so it's omitted from the one-line command). */
function buildCli(m: ShellMethod, vals: Record<string, string>): string {
  const parts = m.params
    .filter((p) => (p.loc === 'path' || p.loc === 'query') && (vals[p.name] ?? '').trim() !== '')
    .map((p) => {
      const v = vals[p.name];
      return /[\s"]/.test(v) ? `${p.name}="${v.replace(/"/g, '\\"')}"` : `${p.name}=${v}`;
    });
  return ['veralith', m.id, ...parts].join(' ');
}

/* Python-literal repr of a JSON value (True/False/None) */
function pyLiteral(v: unknown): string {
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(pyLiteral).join(', ') + ']';
  if (typeof v === 'object') return '{' + Object.entries(v as Record<string, unknown>).map(([k, val]) => `${JSON.stringify(k)}: ${pyLiteral(val)}`).join(', ') + '}';
  return JSON.stringify(v);
}

/* request body from the method's body params + current values (parses JSON-typed values) */
function bodyObject(m: ShellMethod, vals: Record<string, string>): Record<string, unknown> | null {
  const entries = m.params.filter((p) => p.loc === 'body' && (vals[p.name] ?? '').trim() !== '');
  if (entries.length === 0) return null;
  const body: Record<string, unknown> = {};
  for (const p of entries) {
    const raw = vals[p.name];
    if (p.type === 'string') { body[p.name] = raw; continue; }
    try { body[p.name] = JSON.parse(raw); } catch { body[p.name] = raw; }
  }
  return body;
}

/* a runnable snippet for the selected method + params, in the chosen language */
function buildSnippet(m: ShellMethod, vals: Record<string, string>, lang: SnippetLang): string {
  const path = m.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vals[k] ?? `{${k}}`));
  const qp = m.params.filter((p) => p.loc === 'query' && (vals[p.name] ?? '').trim() !== '');
  const qs = qp.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(vals[p.name])}`).join('&');
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
  const body = bodyObject(m, vals);

  if (lang === 'curl') {
    const out = [`curl -s${m.http !== 'GET' ? ` -X ${m.http}` : ''} "${url}"`, `  -H "Authorization: Bearer sk_live_…"`];
    if (body) { out.push(`  -H "Content-Type: application/json"`); out.push(`  -d '${JSON.stringify(body)}'`); }
    return out.join(' \\\n');
  }
  if (lang === 'python') {
    const args = [`    "${url}"`, `    headers={"Authorization": "Bearer sk_live_…"}`];
    if (body) args.push(`    json=${pyLiteral(body)}`);
    return `import requests\n\nresp = requests.${m.http.toLowerCase()}(\n${args.join(',\n')},\n)\nresp.raise_for_status()\nprint(resp.json())`;
  }
  // node (fetch)
  const opts: string[] = [];
  if (m.http !== 'GET') opts.push(`    method: "${m.http}"`);
  opts.push(`    headers: { Authorization: "Bearer sk_live_…"${body ? `, "Content-Type": "application/json"` : ''} }`);
  if (body) opts.push(`    body: JSON.stringify(${JSON.stringify(body)})`);
  return `const resp = await fetch(\n  "${url}",\n  {\n${opts.join(',\n')},\n  },\n);\nconst data = await resp.json();\nconsole.log(data);`;
}

/* ── recursive JSON tree viewer (collapsible, syntax-highlighted) ──────── */
function JsonView({ value }: { value: unknown }) {
  return (
    <div className="wb-json po-mono">
      <JsonNode k={null} v={value} depth={0} last />
    </div>
  );
}
function JsonPrim({ v }: { v: unknown }) {
  if (v === null) return <span className="wb-j-null">null</span>;
  if (typeof v === 'number') return <span className="wb-j-num">{String(v)}</span>;
  if (typeof v === 'boolean') return <span className="wb-j-bool">{String(v)}</span>;
  const s = String(v);
  if (/^https?:\/\//.test(s)) {
    return <span className="wb-j-str">"<a className="wb-j-link" href={s} target="_blank" rel="noreferrer">{s}</a>"</span>;
  }
  return <span className="wb-j-str">"{s}"</span>;
}
function JsonNode({ k, v, depth, last }: { k: string | null; v: unknown; depth: number; last: boolean }) {
  const [open, setOpen] = useState(depth < 2);
  const isArr = Array.isArray(v);
  const isObj = v !== null && typeof v === 'object' && !isArr;
  const pad = { paddingLeft: depth * 14 };
  const keyEl = k !== null ? <span className="wb-j-key">"{k}"</span> : null;
  const colon = k !== null ? <span className="wb-j-punct">: </span> : null;

  if (isArr || isObj) {
    const entries: [string | null, unknown][] = isArr
      ? (v as unknown[]).map((x): [string | null, unknown] => [null, x])
      : Object.entries(v as Record<string, unknown>);
    const o = isArr ? '[' : '{';
    const c = isArr ? ']' : '}';
    if (entries.length === 0) {
      return (
        <div className="wb-j-line" style={pad}><span className="wb-j-sp" />{keyEl}{colon}<span className="wb-j-punct">{o}{c}</span>{!last && <span className="wb-j-punct">,</span>}</div>
      );
    }
    return (
      <div className="wb-j-block">
        <div className="wb-j-line" style={pad}>
          <button type="button" className="wb-j-toggle" onClick={() => setOpen((x) => !x)} aria-label={open ? 'Collapse' : 'Expand'}>{open ? '▾' : '▸'}</button>
          {keyEl}{colon}<span className="wb-j-punct">{o}</span>
          {!open && <button type="button" className="wb-j-ellipsis" onClick={() => setOpen(true)}>… {entries.length}</button>}
          {!open && <span className="wb-j-punct">{c}</span>}
          {!open && !last && <span className="wb-j-punct">,</span>}
        </div>
        {open && entries.map(([ek, ev], i) => (
          <JsonNode key={i} k={ek} v={ev} depth={depth + 1} last={i === entries.length - 1} />
        ))}
        {open && <div className="wb-j-line" style={pad}><span className="wb-j-sp" /><span className="wb-j-punct">{c}</span>{!last && <span className="wb-j-punct">,</span>}</div>}
      </div>
    );
  }
  return (
    <div className="wb-j-line" style={pad}><span className="wb-j-sp" />{keyEl}{colon}<JsonPrim v={v} />{!last && <span className="wb-j-punct">,</span>}</div>
  );
}

/* the VQL / NL demo result table */
function ShellTable({ note }: { note?: string }) {
  return (
    <div className="wb-sh-table">
      <div className="wb-res-head po-mono"><span style={{ width: 120 }}>trace</span><span style={{ width: 58 }}>suff</span><span style={{ width: 58 }}>faith</span><span style={{ flex: 1 }}>cell</span><span style={{ width: 52 }}>latency</span></div>
      <div className="wb-sh-table-rows">
        {SHELL_ROWS.map((r) => (
          <div className="wb-res-row po-mono" key={r[0]}>
            <span style={{ width: 120 }} className="wb-sh-trace">{r[0]}</span>
            <span style={{ width: 58 }}><b className={r[1] < 0.3 ? 'wf-warn' : ''}>{r[1].toFixed(2)}</b></span>
            <span style={{ width: 58 }}>{r[2].toFixed(2)}</span>
            <span style={{ flex: 1 }}><span className="wb-cellpill" style={{ background: `color-mix(in oklab, var(--fcell-${r[3]}) 22%, transparent)`, color: `var(--fcell-${r[3]})` }}>{r[3]}</span></span>
            <span style={{ width: 52 }}>{r[4]}</span>
          </div>
        ))}
      </div>
      <div className="wb-sh-table-foot po-mono">{SHELL_ROWS.length} rows · 38 ms{note ? ` · ${note}` : ''}</div>
    </div>
  );
}

function ConsoleEntryView({ e }: { e: ConsoleEntry }) {
  return (
    <div className="wb-sh-entry">
      <div className="wb-sh-echo po-mono"><span className="wb-sh-echo-p">$</span> {e.command}</div>
      {e.kind === 'api' && (
        <>
          <div className="wb-sh-status po-mono">
            <span className={'wb-sh-verb is-' + e.http.toLowerCase()}>{e.http}</span>
            <span className="wb-sh-path">{e.path}</span>
            <span className={'wb-sh-code' + (e.ok ? ' is-ok' : ' is-err')}>{e.status}</span>
          </div>
          <JsonView value={e.body} />
        </>
      )}
      {e.kind === 'table' && <ShellTable note={e.note} />}
      {e.kind === 'error' && <div className="wb-sh-err po-mono">⚠ {e.message}</div>}
      {e.kind === 'info' && <div className="wb-sh-info po-mono">{e.message}</div>}
    </div>
  );
}

function WbShell({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<ShellMode>('API');
  const [methodId, setMethodId] = useState('traces.list');
  const [paramValues, setParamValues] = useState<Record<string, string>>(() => {
    const m = methodById('traces.list');
    return m ? Object.fromEntries(m.params.map((p) => [p.name, defaultParamVal(p, projectId)])) : {};
  });
  const [lang, setLang] = useState<SnippetLang>('python');
  const [snipCopied, setSnipCopied] = useState(false);
  const tl = methodById('traces.list');
  const [history, setHistory] = useState<ConsoleEntry[]>(() =>
    tl && USE_MOCK ? [{ kind: 'api', command: tl.cli, http: tl.http, path: tl.path, status: '200 OK', ok: true, body: tl.sampleResponse }] : [],
  );
  const [query, setQuery] = useState(() => {
    if (!tl) return '';
    const vals = Object.fromEntries(tl.params.map((p) => [p.name, defaultParamVal(p, projectId)]));
    return buildSnippet(tl, vals, 'python');
  });
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<{ method: ShellMethod; command: string } | null>(null);

  // three adjustable columns: editor | console | Explorer (Explorer is collapsible)
  const [editorW, setEditorW] = useState<number>(() => { const s = Number(localStorage.getItem('wb-sh-editor-w')); return s >= 220 ? s : 400; });
  const [explorerW, setExplorerW] = useState<number>(() => { const s = Number(localStorage.getItem('wb-sh-explorer-w')); return s >= 240 ? s : 326; });
  const [explorerOpen, setExplorerOpen] = useState<boolean>(() => localStorage.getItem('wb-sh-explorer-open') !== '0');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const atBottomRef = useRef(true);
  // Mounted-guard + abort so an in-flight live request is cancelled and never
  // setState()s after a tab switch / drawer close / project remount.
  const aliveRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => { aliveRef.current = false; abortRef.current?.abort(); }, []);

  const method = methodById(methodId);
  const curResource = SHELL_CATALOG.find((r) => r.methods.some((m) => m.id === methodId)) ?? SHELL_CATALOG[0];
  const promptStr = mode === 'API' ? '$' : mode === 'VQL' ? 'vql>' : 'ask>';

  // pin to newest output only when the user is already at the bottom (don't yank them mid-read)
  const onLogScroll = () => {
    const el = logRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };
  useEffect(() => {
    const el = logRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [history, running, pending]);

  // focus the editor on mount, without scroll-jolting the drawer
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);
  // move focus to Confirm when a danger prompt opens
  useEffect(() => { if (pending) confirmRef.current?.focus(); }, [pending]);
  // Escape cancels a pending confirm — and is stopped from also closing the whole drawer
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setPending(null);
      push({ kind: 'info', command: pending.command, message: 'cancelled — no request sent' });
    };
    document.addEventListener('keydown', onKey, true); // capture: beats the drawer's close-on-Escape
    return () => document.removeEventListener('keydown', onKey, true);
  }, [pending]);

  const setCmd = (text: string) => setQuery(text);

  const selectMethod = (id: string) => {
    const m = methodById(id);
    if (!m) return;
    setMethodId(id);
    const vals = Object.fromEntries(m.params.map((p) => [p.name, defaultParamVal(p, projectId)]));
    setParamValues(vals);
    if (mode === 'API') setCmd(buildSnippet(m, vals, lang));
  };
  const onResource = (name: string) => {
    const r = SHELL_CATALOG.find((x) => x.resource === name);
    if (r && r.methods[0]) selectMethod(r.methods[0].id);
  };
  // compute next purely, then sync the command line outside the state updater
  const setParam = (name: string, value: string) => {
    const next = { ...paramValues, [name]: value };
    setParamValues(next);
    const m = methodById(methodId);
    if (mode === 'API' && m) setCmd(buildSnippet(m, next, lang));
  };
  const pickMode = (m: ShellMode) => {
    setMode(m);
    if (m === 'API') { const mm = methodById(methodId); setCmd(mm ? buildSnippet(mm, paramValues, lang) : ''); }
    else if (m === 'VQL') setCmd(DEFAULT_VQL);
    else setCmd(DEFAULT_NL);
  };
  const pickLang = (l: SnippetLang) => {
    setLang(l);
    if (mode === 'API' && method) setCmd(buildSnippet(method, paramValues, l));
  };
  const fill = (q: string) => { setCmd(q); inputRef.current?.focus(); };
  const copySnippet = async () => {
    try { await navigator.clipboard.writeText(query); setSnipCopied(true); setTimeout(() => setSnipCopied(false), 1200); } catch { /* clipboard blocked */ }
  };
  const toggleExplorer = (open: boolean) => {
    setExplorerOpen(open);
    try { localStorage.setItem('wb-sh-explorer-open', open ? '1' : '0'); } catch { /* ignore */ }
  };

  const push = (e: ConsoleEntry) => setHistory((h) => [...h, e]);
  const execApi = (m: ShellMethod, command: string) => {
    // Mock mode: no backend — echo the grounded demo response from the catalog.
    if (USE_MOCK) {
      setRunning(true);
      setTimeout(() => {
        setRunning(false);
        const status = m.http === 'GET' ? '200 OK' : m.kind === 'operate' || m.id === 'traces.send' ? '202 Accepted' : '200 OK';
        push({ kind: 'api', command, http: m.http, path: m.path, status, ok: true, body: m.sampleResponse });
      }, 430);
      return;
    }
    // Ingestion authenticates with a project API key, not the dashboard session,
    // so it can't be fired from here — point the user at the copy-paste snippet.
    if (m.id === 'traces.send') {
      push({
        kind: 'info',
        command,
        message: 'Ingestion uses your project API key (sk_live_…), not your dashboard session. Copy the snippet on the left to send a real trace.',
      });
      return;
    }
    // Live: run the real request as the signed-in user (Supabase JWT). Abortable
    // + mounted-guarded so a tab switch / drawer close mid-request is clean.
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const path = m.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(paramValues[k] ?? ''));
        const qp = m.params.filter((p) => p.loc === 'query' && (paramValues[p.name] ?? '').trim() !== '');
        const qs = qp.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(paramValues[p.name])}`).join('&');
        const url = `${FETCH_BASE}${path}${qs ? `?${qs}` : ''}`;
        const reqBody = bodyObject(m, paramValues);
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (reqBody) headers['Content-Type'] = 'application/json';
        const resp = await fetch(url, { method: m.http, headers, body: reqBody ? JSON.stringify(reqBody) : undefined, signal: ac.signal });
        const text = await resp.text();
        let parsed: unknown;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        if (aliveRef.current) push({ kind: 'api', command, http: m.http, path: m.path, status: `${resp.status} ${resp.statusText}`.trim(), ok: resp.ok, body: parsed });
      } catch (err) {
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        if (aliveRef.current) push({ kind: 'error', command, message: err instanceof Error ? err.message : 'request failed' });
      } finally {
        if (aliveRef.current) setRunning(false);
      }
    })();
  };
  const runQuery = (text: string, qmode: 'VQL' | 'NL') => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      push({ kind: 'table', command: text, note: qmode === 'NL' ? `interpreted as VQL → ${DEFAULT_VQL}` : undefined });
    }, 430);
  };
  const run = () => {
    const text = query.trim();
    if (!text || running || pending) return; // one of {idle, pending-confirm, running} at a time
    if (mode === 'API') {
      const m = method;
      if (!m) { push({ kind: 'error', command: text, message: 'no method selected — pick one in the Explorer →' }); return; }
      const command = buildCli(m, paramValues);
      if (m.danger) { setPending({ method: m, command }); return; }
      execApi(m, command);
    } else {
      runQuery(text, mode === 'VQL' ? 'VQL' : 'NL');
    }
  };
  const confirmRun = () => { if (pending && !running) { execApi(pending.method, pending.command); setPending(null); } };
  const cancelRun = () => { if (pending) { push({ kind: 'info', command: pending.command, message: 'cancelled — no request sent' }); setPending(null); } };

  // drag a divider: editorW grows from the left edge; explorerW grows from the right edge
  const startResize = (which: 'editor' | 'explorer') => (e: React.MouseEvent) => {
    e.preventDefault();
    const container = shellRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    let last = which === 'editor' ? editorW : explorerW;
    const onMove = (ev: MouseEvent) => {
      if (which === 'editor') {
        const max = Math.max(220, rect.width - (explorerOpen ? explorerW : 44) - 220);
        last = Math.max(220, Math.min(ev.clientX - rect.left, max));
        setEditorW(last);
      } else {
        const max = Math.max(240, rect.width - editorW - 220);
        last = Math.max(240, Math.min(rect.right - ev.clientX, max));
        setExplorerW(last);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      try { localStorage.setItem(which === 'editor' ? 'wb-sh-editor-w' : 'wb-sh-explorer-w', String(Math.round(last))); } catch { /* ignore */ }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="wb-body wb-shell3" ref={shellRef}>
      {/* Col 1 — editor */}
      <section className="wb-sh3-col wb-sh3-editor" style={{ width: editorW }}>
        <div className="wb-sh3-col-head">
          <span>Console</span>
          {mode === 'API' && (
            <div className="wb-sh3-head-acts">
              <div className="wb-seg">
                {(['python', 'node', 'curl'] as const).map((l) => (
                  <button key={l} type="button" className={'wb-seg-b' + (l === lang ? ' is-active' : '')} onClick={() => pickLang(l)}>{l}</button>
                ))}
              </div>
              <button type="button" className="wb-copy" onClick={copySnippet} aria-label="Copy snippet" title="Copy snippet">{snipCopied ? '✓' : '⧉'}</button>
            </div>
          )}
        </div>
        <div className="wb-sh-modes">
          {(['API', 'VQL', 'NL'] as const).map((m) => (
            <button key={m} type="button" className={'wb-mode' + (m === mode ? ' is-active' : '')} onClick={() => pickMode(m)}>{m}</button>
          ))}
          <span className="wb-sh-modes-hint">{mode === 'API' ? 'call Veralith functions' : mode === 'VQL' ? 'query your traces' : 'ask in plain English'}</span>
        </div>
        <div className="wb-sh3-editor-body">
          {mode !== 'API' && <span className="wb-sh3-prompt po-mono" aria-hidden="true">{promptStr}</span>}
          <textarea
            ref={inputRef}
            className="wb-sh3-input po-mono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } }}
            spellCheck={false}
            placeholder={mode === 'API' ? 'veralith traces.list project_id=…' : mode === 'VQL' ? 'SELECT … FROM traces' : 'ask in plain English…'}
            aria-label="Shell command editor"
          />
        </div>
        <div className="wb-sh3-editor-foot">
          <span className="wb-sh3-hint">⏎ newline · Ctrl/⌘ + ⏎ run</span>
          <button type="button" className="wb-run" onClick={run} disabled={running} aria-label="Run (Ctrl+Enter)">
            {running ? 'Running…' : <>▶ Run <span className="wb-run-kbd">Ctrl + Enter</span></>}
          </button>
        </div>
      </section>

      <div className="wb-sh-divider" onMouseDown={startResize('editor')} role="separator" aria-orientation="vertical" title="Drag to resize"><span className="wb-sh-divider-grip" /></div>

      {/* Col 2 — console */}
      <section className="wb-sh3-col wb-sh3-output">
        <div className="wb-sh3-col-head">
          <span>Response</span>
          <div className="wb-sh3-head-acts">
            {history.length > 0 && <button type="button" className="wb-sh3-clear" onClick={() => setHistory([])}>Clear</button>}
            {!explorerOpen && <button type="button" className="wb-sh3-show-exp" onClick={() => toggleExplorer(true)} title="Show API Explorer">‹ API Explorer</button>}
          </div>
        </div>
        <div className="wb-sh-log" ref={logRef} onScroll={onLogScroll} role="log" aria-live="polite" aria-label="Console output">
          {history.map((e, i) => <ConsoleEntryView key={i} e={e} />)}
          {running && <div className="wb-sh-running po-mono" role="status">… running</div>}
          {pending && (
            <div className="wb-sh-confirm" role="alertdialog" aria-label="Confirm request">
              <div className="wb-sh-confirm-t po-mono"><span className={'wb-sh-verb is-' + pending.method.http.toLowerCase()}>{pending.method.http}</span> {pending.method.path}</div>
              <div className="wb-sh-confirm-d">⚠ This {pending.method.kind === 'write' ? 'writes data' : 'mutates state'} — <b>{pending.method.label}</b>. Run it?</div>
              <div className="wb-sh-confirm-acts">
                <button type="button" className="wb-run" ref={confirmRef} onClick={confirmRun}>▶ Confirm</button>
                <button type="button" className="wb-sh-cancel" onClick={cancelRun}>Cancel <span className="wb-sh3-esc">Esc</span></button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Col 3 — API Explorer (collapsible to the right) */}
      {explorerOpen ? (
        <>
          <div className="wb-sh-divider" onMouseDown={startResize('explorer')} role="separator" aria-orientation="vertical" title="Drag to resize"><span className="wb-sh-divider-grip" /></div>
          <aside className="wb-sh3-col wb-sh-explorer" style={{ width: explorerW }}>
            <div className="wb-sh-exp-head">
              <span>{mode === 'API' ? 'API Explorer' : mode === 'VQL' ? 'VQL cheatsheet' : 'Ask in plain English'}</span>
              <button type="button" className="wb-sh-exp-collapse" onClick={() => toggleExplorer(false)} aria-label="Collapse Explorer" title="Collapse to the right">›</button>
            </div>
            <div className="wb-sh-exp-body">
              {mode === 'API' && method ? (
                <>
                  <div className="wb-sh-row2">
                    <label className="wb-sh-field2"><span className="wb-sh-lbl">Resource</span>
                      <select className="wb-sh-sel" value={curResource.resource} onChange={(e) => onResource(e.target.value)}>
                        {SHELL_CATALOG.map((r) => <option key={r.resource} value={r.resource}>{r.resource}</option>)}
                      </select>
                    </label>
                    <label className="wb-sh-field2"><span className="wb-sh-lbl">Method</span>
                      <select className="wb-sh-sel" value={methodId} onChange={(e) => selectMethod(e.target.value)}>
                        {curResource.methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="wb-sh-meta2 po-mono">
                    <span className={'wb-sh-verb is-' + method.http.toLowerCase()}>{method.http}</span>
                    <span className="wb-sh-path">{method.path}</span>
                    {method.danger && <span className="wb-sh-danger">{method.kind}</span>}
                  </div>
                  <div className="wb-sh-summary">{method.summary}</div>
                  {method.params.length > 0 && (
                    <div className="wb-sh-params">
                      {method.params.map((p) => (
                        <label className="wb-sh-param" key={p.name}>
                          <span className="wb-sh-param-top"><span className="wb-sh-param-name">{p.name}{p.required && <span className="wb-sh-req">*</span>}</span><span className="wb-sh-param-loc">{p.loc}</span></span>
                          <input className="wb-sh-input2 po-mono" value={paramValues[p.name] ?? ''} placeholder={p.example} onChange={(e) => setParam(p.name, e.target.value)} spellCheck={false} />
                        </label>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {mode === 'VQL' ? (
                    <>
                      <div className="wb-sh-cs-sub">Tables</div>
                      {VQL_SCHEMA.map(([t, cols]) => <div className="wb-sh-cs-row po-mono" key={t}><b>{t}</b> {cols}</div>)}
                      <div className="wb-sh-cs-sub">Examples — click to load</div>
                      {VQL_EXAMPLES.map((q, i) => <button type="button" className="wb-sh-cs-ex po-mono" key={i} onClick={() => fill(q)}>{q}</button>)}
                    </>
                  ) : (
                    <>
                      <div className="wb-sh-cs-sub">Try — click to load</div>
                      {NL_EXAMPLES.map((q, i) => <button type="button" className="wb-sh-cs-ex" key={i} onClick={() => fill(q)}>{q}</button>)}
                      <div className="wb-sh-cs-note">Plain English is interpreted into VQL, then run. (demo)</div>
                    </>
                  )}
                </>
              )}
            </div>
          </aside>
        </>
      ) : (
        <button type="button" className="wb-sh-exp-rail" onClick={() => toggleExplorer(true)} aria-label="Show API Explorer" title="Show API Explorer">
          <span className="wb-sh-exp-rail-chev">‹</span>
          <span className="wb-sh-exp-rail-txt">API Explorer</span>
        </button>
      )}
    </div>
  );
}

/* ── Logs — raw ingestion & judge logs ──────────────────────────────── */

const LOGS: [string, 'info' | 'warn' | 'error', string][] = [
  ['Jun 2 2026 10:42:20', 'info', 'ingest · trace t_f1d9…7a accepted (1.2 kB)'],
  ['Jun 2 2026 10:42:18', 'info', 'judge · grounding-judge → t_f1d9…7a sufficiency=0.91'],
  ['Jun 2 2026 10:41:57', 'warn', 'retrieval · chunk store latency 820ms (>500ms budget)'],
  ['Jun 2 2026 10:41:50', 'error', 'judge · faithfulness-judge timeout on t_0b6a…f1 — retry 1/3'],
  ['Jun 2 2026 10:41:42', 'info', 'ingest · trace t_4ea8…72 accepted (0.9 kB)'],
  ['Jun 2 2026 10:41:39', 'warn', 'judge · low sufficiency 0.34 flagged on t_4ea8…72'],
  ['Jun 2 2026 10:40:18', 'info', 'queue · worker-3 picked job js_88f1 (depth 3)'],
  ['Jun 2 2026 10:39:08', 'error', 'ingest · dropped malformed payload from key vk_test_…9c'],
  ['Jun 1 2026 23:51:17', 'info', 'judge · sufficiency-judge → t_2d10…aa = 0.66'],
  ['Jun 1 2026 23:50:44', 'info', 'webhook · delivered eval.completed → 200 OK (142ms)'],
  ['Jun 1 2026 23:12:09', 'info', 'ingest · trace t_71cd…8e accepted (1.4 kB)'],
  ['Jun 1 2026 22:08:31', 'warn', 'queue · depth 6 — autoscaling judge workers 3→4'],
];

function WbLogs({ slug }: { slug: string }) {
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  // Live mode: subscribe to the SSE event stream. Mock mode: the demo LOGS array.
  const { events, connected, failed } = useEventLog(slug, true);
  const displayRows: { time: string; level: 'info' | 'warn' | 'error'; msg: string }[] = USE_MOCK
    ? LOGS.map((l) => ({ time: l[0], level: l[1], msg: l[2] }))
    : events.map((e) => ({ time: new Date(e.ts).toLocaleTimeString(), level: e.level, msg: e.message }));
  const rows = displayRows.filter(
    (r) => q.trim() === '' || (r.time + ' ' + r.level + ' ' + r.msg).toLowerCase().includes(q.toLowerCase()),
  );

  // "/" focuses the search bar (matching the keyboard hint), unless already typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.target === searchRef.current) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Download the (filtered) log lines as a plain-text file.
  const download = () => {
    const text = rows.map((l) => `${l.time}  ${l.level.toUpperCase()}:  ${l.msg}`).join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'veralith-logs.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="wb-body wb-logs">
      <div className="wb-logs-bar">
        <div className="wb-logs-search-wrap">
          <svg className="wb-logs-search-ic" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            className="wb-logs-search"
            placeholder="Filter and search logs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter and search logs"
          />
          <kbd className="wb-logs-kbd">/</kbd>
        </div>
        {!USE_MOCK && (
          <span className="wf-mlabel" style={{ marginLeft: 8 }}>
            <span
              className={'po-dot' + (connected ? ' po-dot-live' : failed ? '' : ' po-dot-idle')}
              style={failed ? { background: 'var(--po-bad)' } : undefined}
            />{' '}
            {connected ? 'live' : failed ? 'disconnected' : 'connecting…'}
          </span>
        )}
        <button type="button" className="wb-logs-dl" onClick={download} aria-label="Download logs" title="Download logs">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v8 M5 7.5 8 10.5 11 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="wb-logs-head">
        <span className="wb-logs-col-time">Time</span>
        <span className="wb-logs-col-data">Data</span>
      </div>
      <div className="wb-logs-list po-mono">
        {rows.length === 0 && (
          <div className="wb-log-row wb-log-empty">
            {USE_MOCK
              ? 'no matching log lines'
              : q.trim()
                ? 'no matching events'
                : failed
                  ? 'disconnected — event stream unavailable'
                  : 'waiting for live events…'}
          </div>
        )}
        {rows.map((l, i) => (
          <div className={'wb-log-row is-' + l.level} key={i}>
            <span className="wb-log-time">{l.time}</span>
            <span className="wb-log-data">
              <span className={'wb-log-lvl is-' + l.level}>{l.level.toUpperCase()}:</span>
              <span className="wb-log-msg">{l.msg}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Health — derived component status (live: GET /system/health) ─────── */

function HealthDot({ status }: { status: string }) {
  if (status === 'operational') return <span className="po-dot po-dot-live" />;
  if (status === 'down') return <span className="po-dot" style={{ background: 'var(--po-bad)' }} />;
  return <span className="po-dot po-dot-idle" />;
}

function WbHealth({ slug }: { slug: string }) {
  const q = useSystemHealth(slug);
  const data = q.data;
  const comps = data?.components ?? [];
  const overall = data?.status;
  const notNominal = comps.filter((c) => c.status !== 'operational').length;
  const overallLabel =
    overall === 'operational' ? 'All systems operational'
    : overall === 'down' ? 'Service disruption'
    : overall === 'degraded' ? 'Degraded performance'
    : 'Checking…';
  return (
    <div className="wb-body wb-health">
      <div className="wb-health-top">
        <span className="wb-health-status"><HealthDot status={overall ?? 'idle'} /> {overallLabel}</span>
        {data && notNominal > 0 && (
          <span className="wf-mlabel" style={{ marginLeft: 12 }}>{notNominal} component{notNominal === 1 ? '' : 's'} not nominal</span>
        )}
        <span className="wf-chip" style={{ marginLeft: 'auto' }}>live · derived</span>
      </div>
      <div className="wb-health-grid">
        {comps.map((c) => (
          <div className="wb-hc" key={c.key}>
            <div className="wb-hc-head">
              <HealthDot status={c.status} />
              <span className="wb-hc-name">{c.name}</span>
              <span className="wb-hc-up po-mono">{c.detail}</span>
            </div>
          </div>
        ))}
        {!data && q.isLoading && <div className="wf-mlabel" style={{ padding: 8 }}>Checking components…</div>}
        {!data && q.isError && <div className="wf-mlabel" style={{ padding: 8 }}>Health unavailable.</div>}
      </div>
    </div>
  );
}

function WbBody({ tab, slug, projectId, onTab, onManageKeys }: {
  tab: WbTab;
  slug: string;
  projectId: string;
  onTab: (t: WbTab) => void;
  onManageKeys: () => void;
}) {
  switch (tab) {
    // key={projectId} → remount (and re-default project_id) on project switch.
    case 'Shell': return <WbShell key={projectId} projectId={projectId} />;
    case 'Logs': return <WbLogs slug={slug} />;
    case 'Health': return <WbHealth slug={slug} />;
    default: return <WbIntegration slug={slug} projectId={projectId} onTab={onTab} onManageKeys={onManageKeys} />;
  }
}

function WbFooter({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="wb-foot" onClick={onToggle}>
      {!open && <span className="wb-foot-label"><WbLogo /> For the Geeks</span>}
      <div className="wb-foot-icons">
        <button type="button" className="wb-hicon" aria-label={open ? 'Collapse' : 'Expand'} title={open ? 'Collapse' : 'Expand'} onClick={onToggle}><span aria-hidden="true">{open ? '⌄' : '⌃'}</span></button>
      </div>
    </div>
  );
}

/* Full drawer (header + body + footer), pinned bottom; collapses to footer-only. */
export function WorkbenchDrawer({ defaultTab = 'Integration' }: { defaultTab?: WbTab }) {
  const { slug, id: projectId } = useCurrentProject();
  const navigate = useNavigate();
  // Collapsed by default — a fixed strip at the bottom of every page; click to open.
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<WbTab>(defaultTab);
  // Drag-adjustable panel height (persisted, clamped to the viewport).
  const [height, setHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem('wb-height'));
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    return Math.max(WB_MIN_H, Math.min(saved > 0 ? saved : WB_DEFAULT_H, vh - WB_TOP_GAP));
  });

  // Open on demand from elsewhere in the app (e.g. the topbar connection chip),
  // landing on the requested tab.
  useEffect(() => {
    return onOpenWorkbench((tab) => {
      setActive(tab);
      setOpen(true);
    });
  }, []);

  // While the panel is open, lock the page scroll behind it so the wheel
  // scrolls the panel's content, not the page.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('wb-scroll-lock', open);
    return () => html.classList.remove('wb-scroll-lock');
  }, [open]);

  // Close when clicking outside the panel (or pressing Escape).
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Move focus into the panel on open; restore it to the opener on close (a11y).
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      panelRef.current?.focus();
    } else {
      triggerRef.current?.focus?.();
    }
  }, [open]);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const maxH = window.innerHeight - WB_TOP_GAP;
    let last = startH;
    document.body.style.userSelect = 'none';
    function onMove(ev: MouseEvent) {
      last = Math.max(WB_MIN_H, Math.min(maxH, startH + (startY - ev.clientY)));
      setHeight(last);
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      try { localStorage.setItem('wb-height', String(Math.round(last))); } catch { /* ignore */ }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  if (!open) {
    return (
      <div className="wb-foot-only" onClick={() => setOpen(true)} title="Open Workbench">
        <WbFooter open={false} onToggle={() => setOpen(true)} />
      </div>
    );
  }

  return (
    <div className="wb-drawer">
      <div className="wb-backdrop" />
      <div className="wb-panel" style={{ height }} ref={panelRef} role="dialog" aria-modal="false" aria-label="For the Geeks workbench" tabIndex={-1}>
        <div className="wb-resize" onMouseDown={startResize} title="Drag to resize"><span className="wb-grip" /></div>
        <WbHeader active={active} onTab={setActive} onClose={() => setOpen(false)} />
        <WbBody
          tab={active}
          slug={slug}
          projectId={projectId}
          onTab={setActive}
          onManageKeys={() => { setOpen(false); navigate('/settings/api-keys'); }}
        />
        <WbFooter open onToggle={() => setOpen(false)} />
      </div>
    </div>
  );
}
