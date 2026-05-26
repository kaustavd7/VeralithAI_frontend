# Session Handoff — Phase 2 (Overview page)

> Drop the contents below into a fresh Claude Code session. It is self-contained — the new session does not need to see prior conversations.

---

PROJECT:
Veralith dashboard frontend — hallucination diagnostics for RAG pipelines. Lives at `app.veralithai.com`. Phase 0.2 of a longer arc (Phase 0.2.5 = "Heal with Claude Code" lands ~4-6 weeks after launch).

STACK:
- Vite + React 19 + TypeScript (briefing called for React 18; Vite shipped 19 — deviation accepted, no Auth UI to break)
- React Router v7 (`react-router-dom`)
- TanStack Query v5
- Supabase Auth (`@supabase/supabase-js` — custom form, NOT `@supabase/auth-ui-react`)
- CSS variables in `src/styles/tokens.css` (CSS Modules to be added when shell lands)
- Inline SVG for charts (no chart library)
- pnpm workspaces, monorepo at repo root

ARCHITECTURE:
- Monorepo: `apps/dashboard/` (primary), `apps/web/` (Phase 7, lower priority), `packages/` (empty)
- Feature folder split inside `apps/dashboard/src/`:
  - `routes/` — page-level components
  - `components/{shell,overview,detail,primitives}/` — by section
  - `api/` — `client.ts` (single import surface), `types.ts` (contract mirror), `mock.ts` (feature-flagged)
  - `hooks/` — TanStack Query hooks + `useAuth`
  - `lib/supabase.ts` — single shared Supabase client instance
  - `utils/` — `cellMeta.ts`, `format.ts`, `chartMath.ts`
- API client auto-injects Supabase JWT into every request
- Mock layer toggled by `VITE_USE_MOCK_API=true` (currently ON — Dev 1's backend not live yet)

CONSTRAINTS:
- **Pixel-fidelity to the HTML wireframes is the acceptance test.** Side-by-side compare at 1440px. No improvements, no tweaks, no silent design changes.
- No Tailwind, no shadcn/ui, no Recharts/D3, no Redux/Zustand. Wireframe IS the component library; TanStack Query is the only state layer.
- No `any` outside `client.ts`'s parsing layer
- Components stay small — split if >200 lines
- Hooks > components for shared logic
- Mono fonts (IBM Plex Mono) for numbers/IDs/cell names; sans (IBM Plex Sans) for prose
- Desktop-first (1440px). Mobile = "don't crash."
- Phase 0.2.5 pre-commitments MUST be baked in (see CURRENT TASK)

CURRENT TASK:
Build the Overview page. Port `planning/veralith-ai/project/Veralith Dashboard.html` 1:1 into React. Render against hardcoded mock data first; Phase 4 swaps to real API.

The Overview page is the dashboard's home screen — sidebar + main content. Renders at `/projects/:slug`. The placeholder at that route in `App.tsx` is what you're replacing.

Components to build (file paths fixed by convention — do not relocate):
- `components/shell/Sidebar.tsx` — brand, search, nav groups (Workspace / Diagnostics / Pipeline), live status footer
- `components/shell/TopBar.tsx` — breadcrumbs, action buttons
- `components/shell/Brand.tsx`
- `components/shell/LiveStatus.tsx`
- `components/overview/KpiStrip.tsx` — 4 KPI cards (Total / Healthy rate / Avg sufficiency / Avg faithfulness), each clickable
- `components/overview/DiagnosisBanner.tsx` — generic banner; API-driven content (do not hardcode copy — Phase 0.3 reuses this surface for pattern detection)
- `components/overview/CellDistribution.tsx` — 6 horizontal bars (counts + %), clickable to filter table
- `components/overview/VolumeChart.tsx` — port `drawVolume()` from the wireframe's `<script>` verbatim
- `components/overview/SFChart.tsx` — port `drawSF()` from the wireframe's `<script>` verbatim
- `components/overview/LiveStream.tsx` — last ~7 traces; SSE wiring lands in Phase 5
- `components/overview/TraceTable.tsx` — full table of recent traces with filter UI (interactivity OK to stub)
- `utils/chartMath.ts` — `smoothPath`, `smoothArea` ported verbatim from prototype
- `utils/format.ts` — money, percentages, "2m ago"
- `routes/Overview.tsx` — page-level wiring (sidebar + topbar + cards)

§13 PRE-COMMITMENTS — do these RIGHT THE FIRST TIME, not refactored later:
- `Sidebar` nav must be **data-driven** — render from an array of `{ label, icon, route, disabled }` objects, not hardcoded JSX. A "Heal sessions" nav item is added in Phase 0.2.5.
- `DiagnosisBanner` must be a **generic banner** — content comes from props/API, no hardcoded copy. Phase 0.3 uses the same surface for cross-trace pattern alerts.

DONE (already in main):
- Phase 0 — monorepo scaffold, Vite + React + TS, design tokens, routing, query, supabase client stub
- Phase 1 — custom email/OAuth login form (Google + GitHub), `<RequireAuth>` guard, two-step onboarding (project name → API key reveal), mock API layer scoped to `user_id`
- Cleanup — Vite proxy uses `/v1/*` passthrough (matches prod URL shape); env var is `VITE_API_URL`
- Smoke test passed: sign-up → onboarding → API key reveal → land on `/projects/:slug`

The placeholder shown at `/projects/:slug` after onboarding is what you replace.

RELEVANT FILES (already exist, READ THESE FIRST):
- `planning/veralith-ai/project/Veralith Dashboard.html` — the wireframe. Read top-to-bottom. Contains: every CSS var (already ported to `tokens.css`), the exact HTML structure for every component, interaction patterns (sidebar nav scrolls to sections, KPI cards filter table, etc.), inline SVG icons, the chart math (`drawVolume`, `drawSF`, `smoothPath`, `smoothArea`).
- `planning/Context/dashboard_api_contract.md` — frozen v1 API contract. Section 5.6 (`GET /v1/projects/{id}/stats`) and 5.4 (`GET /v1/projects/{id}/traces`) shape the Overview's data. Mirror types into `src/api/types.ts`.
- `planning/Context/dev2_dashboard_briefing_v2.md` — full briefing. §13 has the Phase 0.2.5 pre-commitments above.
- `apps/dashboard/src/styles/tokens.css` — already ported
- `apps/dashboard/src/utils/cellMeta.ts` — already ported
- `apps/dashboard/src/App.tsx` — routes wired; replace the `/projects/:slug` placeholder
- `apps/dashboard/src/routes/Placeholder.tsx` — temporary; delete when Overview is in
- `apps/dashboard/src/api/{client,types,mock}.ts` — Phase 1 slice (projects + api-keys only); Phase 2 stays on mock until Phase 4

API CONTRACT (Phase 2 endpoints — full details in `planning/Context/dashboard_api_contract.md`):

`GET /v1/projects/{id}/stats?since=&until=&bucket=hour|day` returns:
```ts
{
  total_traces: number;
  by_cell: Record<FailureCell, number>;
  healthy_rate: number;              // 0..1
  avg_sufficiency: number;
  avg_faithfulness: number;
  total_cost_usd: number;
  timeseries: { bucket: string; count: number; ok: number; failed: number;
                avg_sufficiency: number; avg_faithfulness: number; }[];
  deltas: { total_traces_pct_24h: number;
            healthy_rate_pp_24h: number;
            avg_sufficiency_delta_24h: number;
            avg_faithfulness_delta_24h: number; };
}
```

`GET /v1/projects/{id}/traces?limit=&offset=&cells=&since=&until=&status=&sort=` returns:
```ts
{
  traces: TraceListItem[];
  total: number;
  has_more: boolean;
}

interface TraceListItem {
  id: number;
  project_id: string;
  query: string;
  response_preview: string;        // first 200 chars
  status: 'queued' | 'evaluating' | 'evaluated' | 'failed';
  failure_cell: CellName | null;
  sufficiency_fraction: number | null;
  faithfulness_fraction: number | null;
  n_sub_questions: number;
  n_claims: number;
  created_at: string;              // ISO 8601
  evaluated_at: string | null;
  latency_ms_total: number | null;
  cost_usd: number | null;
}
```

`GET /v1/projects/{id}/calibration` returns:
```ts
{
  threshold: number;
  n_successful_traces: number;
  percentile: number;
  using_fallback: boolean;
  fallback_value: number;
  computed_at: string;
}
```

Both endpoints accept Supabase JWT (browser) OR `vk_live_...` API key (library) — `client.ts` already handles JWT injection.

NEEDS HELP WITH (in priority order):
1. Reading the wireframe HTML and extracting the exact HTML/CSS structure for each component. The CSS vars are already ported; the layout grid, spacing, and chart math need extracting from the prototype's `<style>` and `<script>` blocks.
2. Building `Sidebar` first — it's shared, high-visibility, and validates the design system port. Make the nav array data-driven (see §13 pre-commitments above).
3. Porting `drawVolume()` and `drawSF()` from the wireframe into React SVG components without changing the math. The functions live in the wireframe's inline `<script>`.
4. Designing the mock data — use the wireframe's `sampleTraces` array as the seed. Add it to `apps/dashboard/src/api/mock.ts` extending the existing in-memory state. The Overview should query through the existing `api.*` client (extended with `getStats`, `listTraces`, `getCalibration`), not bypass it.
5. Side-by-side pixel diff against the wireframe HTML at 1440px viewport. Anything that drifts, surface it BEFORE merging — don't silently change the wireframe.

OPEN QUESTIONS / DECISIONS (resolve before extensive work):
- Filter state location: URL params (so refresh preserves it) or local `useState`? Recommend URL params — survives reload, copy-pastable.
- TraceTable pagination: which-style (limit/offset is what the contract supports). Recommend "Load more" button over numbered pagination for v1.
- Sidebar collapse on narrow widths — out of scope per "desktop-first" — but skeleton structure should not break layout if user drags below 1440.

ENVIRONMENT:
- Node 20+
- pnpm 9 (pinned via `packageManager` field; `corepack enable` works)
- Working directory: `d:\Veralith\Veralith_frontend\`
- `pnpm dev` runs the dashboard at http://localhost:5173
- `pnpm -F dashboard typecheck` must pass before every commit
- `pnpm -F dashboard build` must succeed before every push
- `apps/dashboard/.env.local` already has Supabase URL + anon key + `VITE_USE_MOCK_API=true` (gitignored)

ACCEPTANCE TEST:
Open `planning/veralith-ai/project/Veralith Dashboard.html` in one browser tab. Open `http://localhost:5173/projects/my-rag-app` in another. Side-by-side at 1440px width. They look identical — same spacing, same colors, same fonts, same chart shapes against the wireframe's sample data. Hover/click interactions match (KPI cards highlight, CellDistribution rows filter the table, etc.).

OUT OF SCOPE for this session:
- SSE live updates (Phase 5)
- Real API calls (Phase 4 — stay on mock)
- Trace Detail page (Phase 3)
- API Keys / Settings pages (Phase 6)
- Sign-out button (Phase 6)
- Sentry / E2E tests (Phase 8)

WHEN DONE:
Open a PR titled `feat(overview): Phase 2 — port Veralith Dashboard.html`. Body should include screenshots side-by-side with the wireframe at 1440px. List any deliberate deviations.
