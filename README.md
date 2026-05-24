# veralithai-frontend

Monorepo for the Veralith dashboard (`app.veralithai.com`) and marketing site (`veralithai.com`).

## Layout

```
apps/
  dashboard/     React SPA — the diagnostics dashboard (primary)
  web/           Marketing site (Phase 7)
packages/        Shared code (empty for now)
planning/        Design briefs, API contract, HTML wireframes
```

## Requirements

- Node 20+ (see `.nvmrc`)
- pnpm 9 (`npm i -g pnpm@9` or `corepack enable`)

## Quickstart

```bash
pnpm install
pnpm dev          # runs apps/dashboard on http://localhost:5173
```

## Reference docs

- `planning/Context/dashboard_api_contract.md` — frozen v1 API contract
- `planning/Context/dashboard_design_brief.md` — design intent
- `planning/Context/dev2_dashboard_briefing.md` — full frontend brief
- `planning/veralith-ai/project/` — locked HTML wireframes (pixel-fidelity source of truth)
