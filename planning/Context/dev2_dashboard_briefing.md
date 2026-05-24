# Veralith Frontend — Briefing for Dev 2

> Hand this entire file to your Claude Code instance. It's self-contained — Dev 2's agent doesn't need any prior context on the project.

---

## 1. What you're building, in one paragraph

You're building the **Veralith dashboard** — a React SPA hosted at `app.veralithai.com` that lets users view hallucination diagnostics for their RAG (Retrieval-Augmented Generation) pipelines. Users sign up via Supabase Auth (Google / GitHub / email), get an API key, paste a one-line `veralith.configure(api_key=...)` into their Python RAG code, and watch traces appear live on your dashboard with auto-refresh. The visual design is locked — there are two hand-crafted HTML wireframes you'll port pixel-faithfully into React + TypeScript. Your job is to make those wireframes real, wire them to the FastAPI backend (built in parallel by Dev 1), and ship them to Vercel.

---

## 2. Project context (so design choices make sense)

**Veralith** is a hallucination-diagnosis library for RAG systems. Three LLM-as-judge metrics (Sufficiency / Faithfulness / Completeness) classify each trace into one of six diagnostic cells (`complete_grounded`, `complete_ungrounded`, etc.) with a remediation suggestion. The library (`pip install veralith`) is already public on PyPI; the dashboard is what turns it from a CLI tool into a product.

**The product shape is SaaS:**
- `veralithai.com` — marketing landing page (Dev 2 builds this in Phase 4, lower priority)
- `app.veralithai.com` — **the dashboard you're building** (primary)
- `api.veralithai.com` — FastAPI backend (Dev 1 is building this in parallel)
- Multi-tenant Postgres on Supabase
- Authentication via Supabase Auth (Google + GitHub + email/password)

**The user flow:**
1. Visit `veralithai.com` → click "Sign in"
2. Land on `app.veralithai.com/login` → OAuth → first-time onboarding
3. Create a project → get an API key → copy-paste into their RAG code
4. Their RAG fires traces → traces appear live on the dashboard
5. They click a trace → see the full diagnosis (the second page you build)

---

## 3. Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Build tool | **Vite** | Fast dev server, instant HMR, zero config for React + TS |
| Language | **TypeScript** | Mirrors the backend's Pydantic types; catches API drift at compile time |
| UI framework | **React 18** | Familiar; well-supported by everything else |
| Routing | **React Router v6** | `/login`, `/onboarding`, `/projects/:slug`, `/projects/:slug/traces/:id`, etc. |
| Data fetching | **TanStack Query v5** | Automatic caching, refetch-on-focus, SSE-driven invalidation |
| Auth | **`@supabase/supabase-js` + `@supabase/auth-ui-react`** | OAuth + email/password flows handled for us; we just consume sessions |
| Styling | **CSS Modules + the wireframe's `:root { --token }` system** | Wireframe is already pure CSS with vars; porting it 1:1 keeps the look identical |
| Charts | **Inline SVG (ported from prototype)** | The prototype's smoothPath/smoothArea helpers are already there. No chart library. |
| Icons | Inline SVG from the prototype | Already designed |
| SSE | Native `EventSource` browser API | No library needed |
| Deployment | **Vercel** | Hobby tier is free; one Vercel project per app |

**Do NOT add:**
- Tailwind (the wireframe is pure CSS, ported 1:1 keeps fidelity)
- shadcn/ui or any component library (the wireframe IS the component library)
- Recharts / Visx / D3 (the inline SVG approach is already designed)
- Redux / Zustand (TanStack Query + `useState` handles everything for v1)

---

## 4. The wireframes (your source of truth)

Two complete HTML prototypes live in the project root at `planning/veralith-ai/project/`:

| File | What it shows |
|---|---|
| `Veralith Dashboard.html` | The Overview page — sidebar shell, KPI strip, diagnosis banner, 2×2 grid (cell distribution, trace volume chart, S vs F chart, live trace stream), recent traces table |
| `Veralith Trace Detail.html` | The drill-in page — sidebar shell, big diagnosis banner, Q/R panes with claim-level highlighting, collapsible retrieved chunks, per-claim breakdown table, footer with phase latency bars + token-cost rows |

**Read these files in full** before writing any React. They contain:
- The exact CSS (variables, layout, component styles) — copy these into your `tokens.css`
- The exact HTML structure for each component — your JSX should mirror this
- The exact interaction patterns (sidebar nav scrolls to sections, distribution rows filter table, etc.)
- The exact SVG icons (inline in the HTML — copy them into React components)
- The exact chart math (`smoothPath`, `smoothArea` — port the functions verbatim)

**Pixel-fidelity is the goal.** Side-by-side comparison with the HTML output is the acceptance test. No improvements, no tweaks, no "I think this should be a bit darker."

The wireframes also contain example data (`sampleTraces` array, simulated SSE arrivals). You'll keep that hardcoded as mock data during Phases 1–2, then swap for real API calls in Phase 3.

---

## 5. The design system (extracted from the wireframes)

Put this in `src/styles/tokens.css`:

```css
:root {
  /* surfaces */
  --bg:           #0b0c0e;
  --panel:        #111316;
  --panel-2:      #15181c;
  --panel-3:      #1a1e23;
  --line:         #23262b;
  --line-2:       #2c3037;
  --hover:        #181b1f;

  /* text */
  --fg:           #e9ebee;
  --fg-2:         #b6bac1;
  --fg-3:         #7c828c;
  --fg-4:         #555b66;

  /* accent — calm warm cyan */
  --accent:       #6fd6c4;
  --accent-dim:   #2b4f4a;

  /* failure cells (semantic) */
  --cell-cg:      #4ea872;   /* complete_grounded     — healthy */
  --cell-cu:      #e25c5c;   /* complete_ungrounded   — hallucinated */
  --cell-ig:      #e0a14a;   /* incomplete_grounded   — retrieval gap */
  --cell-iu:      #b53636;   /* incomplete_ungrounded — worst case */
  --cell-eg:      #d4c84a;   /* extra_grounded        — padded */
  --cell-eu:      #e25c5c;   /* extra_ungrounded      — off-topic invention */

  /* highlight backgrounds for claim text */
  --hl-green:     rgba(78, 168, 114, 0.22);
  --hl-green-b:   rgba(78, 168, 114, 0.55);
  --hl-red:       rgba(226, 92, 92, 0.20);
  --hl-red-b:     rgba(226, 92, 92, 0.65);

  --radius:       10px;
  --radius-sm:    6px;
}
```

Typography:
- **IBM Plex Sans** for UI text (weights 400, 500, 600, 700)
- **IBM Plex Mono** for numbers, codes, IDs, cell names, latency values
- Load from Google Fonts (the wireframe already does this — copy the `<link>` tags)

Layout grid:
- **248px sidebar** + flexible main content
- Designed for **1440px viewport** (use `viewport` meta tag accordingly)
- Mobile is NOT a primary use case — dashboard is a developer tool used on laptops

Visual language:
- **Calm by default.** Healthy traces should fade into the background. Only failures stand out.
- **Diagnostic, not punitive.** Suggestions should be helpful and concrete.
- **Mono fonts for data, sans for prose.** Numbers, IDs, cell names always in IBM Plex Mono.

---

## 6. Failure cell taxonomy (you'll color-code these everywhere)

| Cell value | Color var | Meaning |
|---|---|---|
| `complete_grounded` | `--cell-cg` (green) | Healthy. Answered everything; every claim grounded. |
| `complete_ungrounded` | `--cell-cu` (red) | Hallucinated. Answered everything but invented some facts. |
| `incomplete_grounded` | `--cell-ig` (amber) | Retrieval gap. Missed parts of the query; what's there is grounded. |
| `incomplete_ungrounded` | `--cell-iu` (deep red) | Worst case. Missed parts AND fabricated within what was answered. |
| `extra_grounded` | `--cell-eg` (yellow) | Padded. Added unrequested content, all grounded. |
| `extra_ungrounded` | `--cell-eu` (red) | Padded + hallucinated. |

Put this map in `src/utils/cellMeta.ts`:

```ts
export const CELL_META = {
  complete_grounded:     { label: "complete_grounded",     color: "#4ea872", short: "CG" },
  complete_ungrounded:   { label: "complete_ungrounded",   color: "#e25c5c", short: "CU" },
  incomplete_grounded:   { label: "incomplete_grounded",   color: "#e0a14a", short: "IG" },
  incomplete_ungrounded: { label: "incomplete_ungrounded", color: "#b53636", short: "IU" },
  extra_grounded:        { label: "extra_grounded",        color: "#d4c84a", short: "EG" },
  extra_ungrounded:      { label: "extra_ungrounded",      color: "#e25c5c", short: "EU" },
} as const;

export type CellName = keyof typeof CELL_META;
```

---

## 7. Repo + folder structure

The frontend lives in a **private monorepo** called `veralithai-frontend`. Two apps inside.

```
veralithai-frontend/
├── package.json                       # workspace root (pnpm or npm workspaces)
├── pnpm-workspace.yaml                # if using pnpm
├── apps/
│   ├── dashboard/                     # YOUR PRIMARY FOCUS — app.veralithai.com
│   │   ├── package.json
│   │   ├── vite.config.ts             # configure /api proxy in dev
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── public/
│   │   └── src/
│   │       ├── main.tsx               # entry, TanStack Query provider, BrowserRouter
│   │       ├── App.tsx                # router definitions
│   │       ├── routes/
│   │       │   ├── Login.tsx
│   │       │   ├── Signup.tsx
│   │       │   ├── Onboarding.tsx     # first-time project creation + API key
│   │       │   ├── Overview.tsx       # the main dashboard
│   │       │   ├── TraceDetail.tsx    # /traces/:id
│   │       │   ├── ApiKeys.tsx
│   │       │   └── ProjectSettings.tsx
│   │       ├── components/
│   │       │   ├── shell/
│   │       │   │   ├── Sidebar.tsx
│   │       │   │   ├── TopBar.tsx
│   │       │   │   ├── Brand.tsx
│   │       │   │   └── LiveStatus.tsx
│   │       │   ├── overview/
│   │       │   │   ├── KpiStrip.tsx
│   │       │   │   ├── DiagnosisBanner.tsx
│   │       │   │   ├── CellDistribution.tsx
│   │       │   │   ├── VolumeChart.tsx
│   │       │   │   ├── SFChart.tsx
│   │       │   │   ├── LiveStream.tsx
│   │       │   │   └── TraceTable.tsx
│   │       │   ├── detail/
│   │       │   │   ├── DiagnosisHero.tsx
│   │       │   │   ├── QueryPane.tsx
│   │       │   │   ├── ResponsePane.tsx     # the claim-highlighting magic
│   │       │   │   ├── RetrievedChunks.tsx
│   │       │   │   ├── PerClaimTable.tsx
│   │       │   │   └── LatencyFooter.tsx
│   │       │   └── primitives/         # Button, Card, Chip, Tooltip, EmptyState, etc.
│   │       ├── api/
│   │       │   ├── client.ts           # fetch wrapper with auth header injection
│   │       │   └── types.ts            # TS mirror of backend's Pydantic
│   │       ├── hooks/
│   │       │   ├── useAuth.ts          # Supabase session + user
│   │       │   ├── useProject.ts       # current project from URL slug
│   │       │   ├── useTraces.ts        # GET /v1/traces
│   │       │   ├── useTrace.ts         # GET /v1/traces/:id
│   │       │   ├── useStats.ts
│   │       │   ├── useCalibration.ts
│   │       │   └── useLiveEvents.ts    # SSE → invalidate cache
│   │       ├── lib/
│   │       │   └── supabase.ts         # supabase-js init
│   │       ├── styles/
│   │       │   ├── tokens.css          # the :root vars from above
│   │       │   ├── reset.css
│   │       │   └── shell.module.css    # sidebar + topbar layout
│   │       └── utils/
│   │           ├── cellMeta.ts
│   │           ├── format.ts           # money, percentages, "2m ago", etc.
│   │           └── chartMath.ts        # smoothPath, smoothArea ported from prototype
│   │
│   └── web/                            # veralithai.com — LOWER PRIORITY (Phase 4)
│       ├── package.json
│       ├── vite.config.ts
│       └── src/                        # simple landing page
│
└── packages/                           # shared, if it grows
    └── (empty for now)
```

If pnpm workspaces feel like ceremony, just two unrelated folders is fine. We add the workspace root if we ever share code.

---

## 8. Pages you need to build (in priority order)

### Page 1 — `/login` (Phase 1)

The Supabase Auth UI, styled to match the brand.

```tsx
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

<Auth
  supabaseClient={supabase}
  appearance={{ theme: ThemeSupa, variables: { default: { colors: { ... } } } }}
  providers={['google', 'github']}
  redirectTo={`${window.location.origin}/onboarding`}
/>
```

Customize the colors to match the dark theme. The login screen should feel like part of the dashboard, not a generic Supabase widget.

### Page 2 — `/onboarding` (Phase 1)

First-time-only. Two steps:

1. "Create your first project" — single text input for project name, submits a `POST /v1/projects` → redirects to step 2
2. "Your API key" — shows the generated `vk_live_...` key, the copy-paste code snippet, a big "I've copied it, take me to the dashboard" button

```
┌────────────────────────────────────────────────────┐
│  Welcome to Veralith                                │
│                                                      │
│  Let's create your first project. A project is one   │
│  RAG application you want to monitor.                │
│                                                      │
│  Project name:  [ my-rag-app          ]              │
│                                                      │
│                              [ Create project → ]    │
└────────────────────────────────────────────────────┘
```

After creation:

```
┌────────────────────────────────────────────────────┐
│  Here's your API key for "my-rag-app"               │
│                                                      │
│  vk_live_abc123...xyz   [ Copy ]                     │
│                                                      │
│  Add this to your Python RAG code:                   │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ import veralith                                 ││
│  │ veralith.configure(api_key="vk_live_...")       ││
│  │                                                 ││
│  │ @veralith.trace                                 ││
│  │ def my_rag(query):                              ││
│  │     chunks = retrieve(query)                    ││
│  │     answer = generate(query, chunks)            ││
│  │     return answer, chunks                       ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  [ I've copied it, take me to the dashboard → ]      │
└────────────────────────────────────────────────────┘
```

The API key is shown **once and only once**. After this page, only the prefix is shown anywhere (`vk_live_abc...`).

### Page 3 — `/projects/:slug` Overview (Phase 2)

**This is the main dashboard.** Port from `planning/veralith-ai/project/Veralith Dashboard.html` 1:1.

Components to build:
- **Sidebar** (`components/shell/Sidebar.tsx`) — brand, search, nav groups (Workspace / Diagnostics / Pipeline), live status footer
- **TopBar** (`components/shell/TopBar.tsx`) — breadcrumbs, action buttons
- **FilterBar** — project selector, cell filter, time range
- **KpiStrip** (`components/overview/KpiStrip.tsx`) — 4 KPI cards (Total traces, Healthy rate, Avg sufficiency, Avg faithfulness). Each clickable, scrolls to or filters the table.
- **DiagnosisBanner** (`components/overview/DiagnosisBanner.tsx`) — context-aware banner highlighting something interesting (e.g., "5 traces landed in incomplete_ungrounded in the last hour"). Computed server-side, shown conditionally.
- **CellDistribution** (`components/overview/CellDistribution.tsx`) — 6 horizontal bars with counts + percentages, clickable to filter table
- **VolumeChart** (`components/overview/VolumeChart.tsx`) — line + area chart of trace volume over time. Port `drawVolume()` from the prototype's `<script>`.
- **SFChart** (`components/overview/SFChart.tsx`) — two-line chart of Sufficiency vs Faithfulness averages over time. Port `drawSF()` from the prototype.
- **LiveStream** (`components/overview/LiveStream.tsx`) — last ~7 traces, prepending new ones via SSE with fade-in animation. Each row clickable to detail page.
- **TraceTable** (`components/overview/TraceTable.tsx`) — full table of recent traces with filters

### Page 4 — `/projects/:slug/traces/:id` Trace Detail (Phase 2)

Port from `planning/veralith-ai/project/Veralith Trace Detail.html` 1:1.

Components to build:
- **DiagnosisHero** (`components/detail/DiagnosisHero.tsx`) — big banner with cell pill, cell name, meaning, S+F boxes, suggestion title/body, action list, copy-as-Markdown button
- **QueryPane** (`components/detail/QueryPane.tsx`) — the query text + decomposed sub-questions with PASS/FAIL/UNCOVERED verdicts
- **ResponsePane** (`components/detail/ResponsePane.tsx`) — **the critical component**. Response text with each claim wrapped in a `<span class="claim ok|bad">` that has a hover-tooltip showing the judge's reasoning. This is the dashboard's "wow" feature — when users hover a sentence, they see the judge's verdict for that exact sentence.
- **RetrievedChunks** (`components/detail/RetrievedChunks.tsx`) — collapsible (`<details>` element from the prototype) list of chunks with rank, source, similarity, cited-by pill, and chunk text. Hovering a chunk cross-highlights the claims that cite it.
- **PerClaimTable** (`components/detail/PerClaimTable.tsx`) — table of every claim with verdict, judge reasoning, grounding chunks
- **LatencyFooter** (`components/detail/LatencyFooter.tsx`) — bar chart of per-phase latencies + token/cost rows

### Page 5 — `/projects/:slug/api-keys` (Phase 2)

A simple table — list of keys (prefix only, never the secret), names, last-used dates, "Revoke" buttons, and a "Generate new key" CTA.

### Page 6 — `/projects/:slug/settings` (Phase 2)

Project name, delete project button. Minimal.

---

## 9. API contract

**Base URL:** `https://api.veralithai.com` in production, `http://localhost:8000` in dev.

**Auth header:** every request includes `Authorization: Bearer <JWT or API key>`. The dashboard uses the JWT from Supabase; the library uses the `vk_live_...` API key. Both authenticate to the same endpoints.

**Endpoints you'll call from the dashboard:**

```
GET    /v1/projects                                List user's projects
POST   /v1/projects                                Create
DELETE /v1/projects/{id}                           Delete

POST   /v1/projects/{id}/api-keys                  Generate key (returned ONCE)
GET    /v1/projects/{id}/api-keys                  List keys (without secret)
DELETE /v1/projects/{id}/api-keys/{key_id}         Revoke

GET    /v1/projects/{id}/traces                    List traces (paginated, filterable)
GET    /v1/projects/{id}/traces/{trace_id}         Full trace detail
GET    /v1/projects/{id}/stats                     Aggregates
GET    /v1/projects/{id}/calibration               Per-project learned threshold
GET    /v1/projects/{id}/events                    SSE stream
```

**Exact JSON shapes** are documented in `planning/dashboard_design_brief.md` (read that file for the full reference). The shapes use these top-level types:

```ts
export interface TraceListItem {
  id: number;
  query: string;
  response_preview: string;
  failure_cell: CellName;
  sufficiency_fraction: number;
  faithfulness_fraction: number;
  n_sub_questions: number;
  n_claims: number;
  created_at: string;     // ISO 8601
  latency_ms_total: number;
  cost_usd: number;
}

export interface TraceDetail {
  id: number;
  query: string;
  response: string;
  created_at: string;
  context_chunks: ContextChunk[];
  sub_questions: SubQuestion[];
  claims: Claim[];
  completeness: CompletenessJudgment;
  diagnosis: Diagnosis;
  suggestion: Suggestion;
  latency_ms: Record<string, number>;
  errors: Record<string, string>;
}
```

Dev 1 will publish the canonical `dashboard_api_contract.md` before either of you start coding — that's the freeze point. Mirror that contract into `src/api/types.ts`.

**SSE events** (`GET /v1/projects/{id}/events`):

```
event: trace_evaluated
data: { "id": 43, "failure_cell": "complete_grounded", "sufficiency_fraction": 1.0, "faithfulness_fraction": 1.0 }
```

The `useLiveEvents()` hook subscribes on mount, and on each event calls `queryClient.invalidateQueries(['traces'])`. TanStack Query refetches; the table updates; the LiveStream component prepends a fading row.

---

## 10. Auth flow (Supabase Auth)

Set up:

```bash
npm install @supabase/supabase-js @supabase/auth-ui-react @supabase/auth-ui-shared
```

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

`src/hooks/useAuth.ts`:

```ts
export function useAuth() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, user: session?.user, signOut: () => supabase.auth.signOut() };
}
```

Wrap protected routes in a `<RequireAuth>` component that redirects to `/login` if no session.

The JWT is automatically included via the Supabase client when you query the database directly. For calls to `api.veralithai.com`, the `client.ts` fetch wrapper attaches the JWT manually:

```ts
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
fetch(url, { headers: { Authorization: `Bearer ${token}` } });
```

---

## 11. Phased build order (your 4-week plan)

### Phase 0 — Scaffold (Day 1)
- Create `veralithai-frontend` private GitHub repo
- Set up pnpm workspace (or just two folders)
- Scaffold `apps/dashboard/` with Vite + React + TS
- Configure Vite dev proxy: `/api/*` → `http://localhost:8000`
- Port the design tokens (`src/styles/tokens.css`)
- Set up React Router with route stubs
- Set up TanStack Query provider
- Set up Supabase client + `useAuth` hook
- Get a "hello world" running at `localhost:5173`

### Phase 1 — Auth + onboarding (Days 2-3)
- Build `/login` with Supabase Auth UI
- Build `/onboarding` (project creation + API key reveal)
- Build the protected-routes wrapper
- Wire to backend endpoints (`POST /v1/projects`, `POST /v1/projects/{id}/api-keys`)
- Acceptance: a user can sign up, create a project, see their API key

### Phase 2 — Overview page UI (Days 4-8)
- Build the shell components (Sidebar, TopBar)
- Build each Overview card with hardcoded mock data (copy from the prototype's `sampleTraces`)
- Port the volume + SF charts as React components (functions from the prototype HTML)
- Side-by-side compare with the wireframe HTML — fix any visual drift
- Acceptance: `/projects/test-project` renders the Overview pixel-faithfully against mock data

### Phase 3 — Trace Detail page UI (Days 9-12)
- Build all detail components with mock data
- **Special focus on ResponsePane** — get claim hover tooltips right (this is the wow feature)
- Build retrieved chunks (collapsible), per-claim table, latency footer
- Acceptance: `/projects/test-project/traces/1246` renders pixel-faithfully

### Phase 4 — Wire to real API (Days 13-15)
- Build `src/api/client.ts` and `types.ts` (mirror Dev 1's published contract)
- Build TanStack Query hooks (`useTraces`, `useTrace`, `useStats`, `useCalibration`)
- Replace mock data in every component with hook calls
- Add loading states (skeleton screens) and error states
- Acceptance: dashboard shows real data from a real backend deployment

### Phase 5 — Live updates (Days 16-17)
- Build `useLiveEvents()` SSE hook
- Wire to LiveStream (prepend new rows with fade animation)
- Wire to TraceTable (invalidate cache, refetch)
- Wire to KpiStrip (refetch stats)
- Acceptance: trigger a trace via curl → it appears in the dashboard within ~1 second, no refresh

### Phase 6 — Polish (Days 18-20)
- Empty states (no traces yet, no projects yet)
- Connection-lost banner
- 404 page
- Accessibility pass (keyboard nav, focus rings, alt text)
- Mobile fallback (at least scrollable, not pretty)
- Deploy to Vercel staging

### Phase 7 — Marketing site (Days 21-25, after dashboard ships)
- Scaffold `apps/web/`
- Build landing page (hero, features, screenshots, CTA → signup)
- Deploy to Vercel production (`veralithai.com`)

### Phase 8 — Launch readiness
- E2E smoke test (Playwright: signup → onboarding → submit a trace via curl → see it on dashboard)
- Vercel custom domain (`app.veralithai.com`)
- Sentry for frontend error tracking
- Ship

---

## 12. Coordination with Dev 1 (the backend)

**Dev 1 owns the backend** (`veralithai-backend` private repo, FastAPI on Railway, Supabase schema). You don't touch their code; they don't touch yours.

The contract between you is:
1. **`planning/dashboard_api_contract.md`** — written by Dev 1 before either of you code. Frozen. Changes go through review.
2. **Supabase schema** — Dev 1 maintains migrations. You read the schema via Supabase client (for auth) but never write to it directly except through the backend API.
3. **SSE event shape** — locked in the contract doc.

**Sync points:**
- **End of Day 1** — Both scaffolds running. Your `npm run dev` shows the sidebar; their `uvicorn` returns `{}` from `/v1/traces`. Confirm Vite proxy forwards `/api/*` to their port.
- **End of Day 5** — Their auth + project endpoints are live; you wire your onboarding flow to them.
- **End of Day 12** — Their trace endpoints are live; you swap your mock data for real calls.
- **End of Day 17** — Their SSE endpoint is live; you wire live updates.

If either side wants to change the contract, post in your team chat first, agree, then change. Surprises break parallel work.

---

## 13. Quality bar

Three things to commit to:

1. **Pixel-fidelity to the prototype.** Side-by-side compare the wireframe HTML with your React output. No improvements without explicit Dev 1 / user approval. Match the spacing, colors, fonts, sizes, animations exactly. If something feels wrong, raise it — don't silently change it.

2. **Type safety end-to-end.** Every API response is typed via `src/api/types.ts`. Every component prop is typed. No `any` outside `client.ts`'s parsing layer. If TS complains, you fix it — don't `@ts-ignore`.

3. **No breaking changes between branches.** Work on feature branches. Open PRs even if you're the only reviewer (it makes diffs visible). Use `main` as a known-good state — `main` should always run cleanly with `npm run dev`.

Test discipline:
- **Manual UI checklist** per release. (E2E Playwright tests in Phase 8.)
- **TypeScript compile** must pass (`tsc --noEmit`) before every commit.
- **`npm run build`** must succeed before every push (catches Vite-specific issues you don't see in dev mode).

Code style:
- Follow existing patterns in the repo. If you're the first one writing a particular kind of code, pick a convention and document it briefly in the PR.
- Components stay small. If one file exceeds ~200 lines, split it.
- Hooks > components for shared logic.
- No prop drilling beyond 2 levels. Use TanStack Query as a global cache instead.

---

## 14. First-day checklist

1. [ ] Read both HTML wireframes top-to-bottom (`planning/veralith-ai/project/`)
2. [ ] Read `planning/dashboard_api_contract.md` (Dev 1 will publish this before you start)
3. [ ] Read `planning/dashboard_design_brief.md` (deeper design context)
4. [ ] Create the `veralithai-frontend` private GitHub repo + clone
5. [ ] Scaffold `apps/dashboard/` with Vite + React + TS (`pnpm create vite apps/dashboard --template react-ts`)
6. [ ] Install deps: `@supabase/supabase-js @supabase/auth-ui-react @supabase/auth-ui-shared @tanstack/react-query react-router-dom`
7. [ ] Port the design tokens into `src/styles/tokens.css`
8. [ ] Get IBM Plex Sans + Mono loading via the Google Fonts `<link>` from the prototype
9. [ ] Build the Sidebar component first — it's shared and high-visibility
10. [ ] Open a PR on day 1 even if it's just the scaffold — establishes the review rhythm

---

## 15. Things you'll probably want to ask

- **"What if the backend isn't ready when I need to wire something up?"** Use mock data. Every component should work against hardcoded JSON during development. The contract doc tells you the exact shape — you can mock-implement that shape immediately.
- **"What if I disagree with a design decision in the wireframe?"** Implement the wireframe first. Note your concern. Raise it after — design changes go through Dev 1 / user, not into the code unilaterally.
- **"Do I need to handle multi-project switching in v1?"** Yes — the project slug is in the URL (`/projects/:slug`), and a top-bar dropdown lets users switch. But v1 expects most users to have only one project, so the dropdown can be simple.
- **"What about real-time chart updates?"** SSE handles trace arrivals. Charts that show aggregates (KpiStrip, VolumeChart, SFChart) refetch on a 30-second interval via `refetchInterval` in TanStack Query. That's good enough.
- **"What if the user has zero traces?"** Empty state component (`primitives/EmptyState.tsx`) that says "Your first trace will appear here as soon as it arrives" + a hint to check their API key in their RAG code. The same empty state appears in the trace list, the live stream, the chart areas.
- **"Mobile?"** Dashboard is desktop-first. Make sure nothing crashes on mobile, but don't spend hours making charts responsive. The trace list should at least scroll; that's enough for v1.

---

Build for pixel-fidelity, type safety, and the live-update wow factor. That's the whole job for the next 4 weeks. Ask questions early — don't guess on the contract.
