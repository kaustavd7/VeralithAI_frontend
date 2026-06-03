# web — Veralith marketing site

The public landing page at **veralithai.com**.

A single self-contained static page (`index.html`) — preloader, sticky nav,
an animated live claim-verification demo, and the product story
(problem → how it works → features → integrate → playground → pricing).
No framework, no API calls, no build-time modules; the only external
dependency is Google Fonts (Hanken Grotesk + JetBrains Mono). Vite just
serves it in dev and copies it to `dist/` on build.

The source of truth for the page is `index.html` (copied from the
`veralith_3RD_JUNE.html` design prototype). Edit it directly.

## Develop

```bash
pnpm install            # from the repo root
pnpm -F web dev         # http://localhost:5174
```

## Build

```bash
pnpm -F web build       # → apps/web/dist
pnpm -F web preview     # preview the production build
```

## Deploy

Vercel project rooted at `apps/web`. `vercel.json` builds with `pnpm build`
and serves `dist/`. Point the `veralithai.com` domain at this project.
