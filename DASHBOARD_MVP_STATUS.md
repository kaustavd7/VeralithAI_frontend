# Veralith Dashboard — MVP Readiness & Close-Out Plan

*Generated 2026-06-17 from a full per-page functional audit. The dashboard runs on http://localhost:5173.*

## TL;DR
The **interaction layer is production-quality** (~95% of pixels are real, well-built, interactive). But **the data is almost entirely mock/demo** — out of the box `.env` ships `VITE_USE_MOCK_API=true`, so every `api.*` call short-circuits to in-memory fixtures (`src/api/mock.ts`). **Auth is the one fully-real subsystem** (Supabase JWT runs live in both modes). Two of the most-visited pages (Today/Overview, Failure Cells) don't even use the mock data layer — they render hardcoded constants / a synthetic generator. **This is an excellent demo, not a closed MVP.**

Path to close: **(1)** reconcile the field-name contract drift, **(2)** flip to the live API + route the real-data pages, **(3)** wire the dead drill-down links, **(4)** add loading/error/empty states + action error handling, **(5)** project-scope heals.

---

## Per-page readiness

| Page | Verdict | Notes |
|---|---|---|
| **Login / Onboarding / 404** | ✅ working | Login is the most production-ready file — real Supabase signin/signup/OAuth/redirect. Onboarding create-project+key flow complete. Risks: no `/auth/callback` route, no forgot-password. |
| **ProjectsHome** | 🟡 partial | Search/pin/drag-reorder/create/nav all work — but mock seeds **zero** projects (empty grid), created projects vanish on refresh, no loading/error/empty handling. |
| **TraceExplorer** | 🟡 partial | Filters/sort/search/pagination/CSV-of-page/row-nav/URL-seeding work on 13 seed rows. SortPill mislabels 4/6 options; `/` hotkey + row Enter/Space are dead. |
| **TraceDetail** | 🟡 partial | Copy-md, claim↔chunk hover, collapsible chunks, nav work — but every id renders the **same** fixture; 3 action buttons dead; HealButton is a stub; **`*_fraction` vs backend `*_score` will crash live mode.** |
| **Analytics** | 🟠 mostly-demo | 4 rich interactive panels + leaderboard→trace drill-through — but mock ignores time windows (cosmetic), hallucination panel reads 0%, all dashboard-builder controls disabled. |
| **TodayOverview** (live landing) | 🟠 mostly-demo | **100% hardcoded constants** — doesn't touch the data layer; identical across projects; 2 drill-down links + header chips are dead no-ops. |
| **FailureCells** | 🟠 mostly-demo | Fully interactive charts/zoom/breakout — but **zero real or mock data** (in-file synthetic generator on a frozen May-2026 origin); no backend endpoint exists. |
| **Heals** | 🟡 partial | Tabs/split/6 actions/confirm-modals/polling work on 2 seed cards — but list is **not project-scoped**, actions have no error UI / in-flight disabling, real heal/PR/MCP loop is backend-only. |
| **Settings** | 🚧 stub | Only Sign out + client-side name edit work; sidebar decorative; Save disabled (no `PATCH /v1/me`); Billing/Notifications/API-keys "coming soon"; shows mock user. |
| **App Shell + Workbench** | 🟡 partial | Nav/switcher/theme/sidebar-modes/drawer all work — but Workbench is demo-only with **hardcoded real-looking `sk_live_`/`vk_live_` keys (launch hazard)**, 5 routeless sidebar stubs, dead ⌘K pill. |

---

## 🔴 MVP blockers (must fix to "close")
1. **Default is demo** — flip `VITE_USE_MOCK_API=false` per-env and verify end-to-end against the live backend.
2. **Contract drift (breaks live mode)** — `DiagnosisHero`/`Diagnosis` use `*_fraction` with unguarded `.toFixed()`; backend emits `*_score` → TraceDetail throws/NaN the moment mock is off. Reconcile field names. Guard `CELL_META[failure_cell]` for unknown cells.
3. **Live landing is a mockup** — `/projects/:slug` → `TodayOverview` is 100% hardcoded. Route the real-wiring twin `ProjectOverview.tsx` (already consumes `useStats/useTraces/useApiKeys`) or wire `TodayOverview` to the hooks.
4. **FailureCells fully synthetic** — no backing endpoint. Ship `GET /v1/projects/{id}/analytics/cells/timeseries` (or aggregate stats/traces) **or descope** the page from MVP.
5. **Heals not project-scoped** — `api.listHeals()` called with no args under a bare `['heals']` key. Pass `projectId` + `status_filter` + `limit`.
6. **No action error handling** — Heals' 6 mutations have no `onError` UI and no in-flight disabling (silent fail + double-submit).
7. **Missing `/auth/callback`** — OAuth PKCE relies on landing on a `RequireAuth` route; can silently bounce to `/login`.
8. **No loading/error/empty states** on data pages (a failed real fetch looks like "no projects").
9. **Hardcoded `sk_live_`/`vk_live_` keys** rendered + copyable in Workbench — security/credibility hazard.
10. **Email confirmation disabled on dev Supabase** — re-enable before launch (the "check your inbox" branch becomes load-bearing).
11. **Settings read-only** — wire `getMe` live; add `PATCH /v1/me` (or descope Save).

---

## Phase 2 — Internal navigation (decide + wire)

**Existing & wired:** project card→overview · trace row→detail · breadcrumb/back→traces · Analytics leaderboard row→trace · heals row→detail · View-PR external · sidebar routed items · topbar switcher/account.

**Proposed new drill-downs (the convention: anything cell-colored or count-like → filtered Traces / the relevant page):**
- TodayOverview: "Review all heals →" → `/heals`; "Explore topic clusters →" → `/analytics/cells`; knowledge-gap rows → `/traces?cells=<cell>`; HealthDonut slices/legend → `/traces?cells=<cell>`; 4 KPI cards → Traces / Failure cells / Heals / Analytics; improvement-contributor rows → `/heals/:cardId`.
- TraceExplorer: in-row cell pill → add that cell to active filter; cell chip → `/analytics/cells`.
- TraceDetail: `failure_cell` pill → `/traces?cells=<cell>`; "Open raw JSON" → raw view; citation refs (cited by R0) → jump/pin; link to this category's heal.
- Analytics: cell bubbles/legend/badges → `/traces?cells=<cell>`; volume/hallucination peak → `/traces` filtered by bucket.
- FailureCells: breakout cards/legend → `/traces?cells=<cell>&since&until` (listTraces already supports `cells`).
- Heals: evidence-trace rows → `/traces/:id`; `previous_card_id` raw `<a>` → React Router navigate; n_traces → filtered traces.
- Topbar ⌘K → command palette (new); Settings sidebar → section switching; Workbench "Manage API keys/Send test trace" → real targets.
- 404 → "Back to projects" CTA. Sidebar stubs (Live/Calibration/Judges/Chunks/Queue) → build or hide.

---

## Phase 3 — Backend wiring (per data surface → endpoint)
- **ProjectsHome** → `GET /v1/projects` (shaped; flip mock off).
- **Create project + key** → `POST /v1/projects` + `…/api-keys` (path correct).
- **Today landing** → `GET …/stats` (hero/KPIs/donut/latency) + `GET /v1/heals` (counts) — **currently hardcoded**; route `ProjectOverview.tsx` or wire hooks. RAG-health/knowledge-gap/projection/Ver-advice/badges have **no endpoint** (need new `insights/*`).
- **TraceExplorer** → `GET …/traces?…` (shaped; backend must honor `since/until/bucket`, add server-side sort + search; real CSV export).
- **Cell counts / Analytics** → `GET …/stats?bucket` (`by_cell` + timeseries; needs `faithfulness_lt_0_6` per bucket).
- **TraceDetail** → `GET …/traces/{id}` (exists; **fix `*_fraction`↔`*_score` drift first**; surface `latency_ms_total`).
- **FailureCells** → new `analytics/cells/timeseries` or descope.
- **Heals** → `GET /v1/heals` (scope it) + `GET /v1/heals/{id}` + `POST …/{action}`; heal/retry need MCP loop, accept/decline need GitHub PR ops.
- **Profile** → `GET /v1/me` (flip mock off) + new `PATCH /v1/me`; Billing/Notifications new.
- **API keys UI** → `GET/POST/DELETE …/api-keys` (replace hardcoded keys).
- **OAuth** → add `/auth/callback`, allow-list providers, re-enable email confirmation.

---

## ⚡ Quick wins (low-effort, high-value)
- Fix TraceExplorer **SortPill label bug** (mislabels 4/6 sorts).
- Wire TodayOverview's 2 dead links ("Review all heals", "Explore topic clusters").
- **Pre-seed demo projects** in `mock.ts` (empty today → empty grid).
- Heals `previous_card_id` raw `<a>` → React Router navigate (full reload wipes state).
- Add Enter/Space key handlers to trace rows; implement-or-remove the `/` search hotkey badge.
- Hide/disable TraceDetail's dead buttons (Re-evaluate / Flag FP / Open raw JSON) like the HealButton stub pattern.
- 404 "Back to projects" CTA; hide the dead ⌘K pill.
- Guard `CELL_META[failure_cell]` default.
- Fix Heals flash-cleanup `useEffect` (cleanup returns inside the for-loop → only first timer cleared).
