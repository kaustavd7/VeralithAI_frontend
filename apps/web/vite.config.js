import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Marketing site (veralithai.com). Self-contained static pages — no framework,
// no bundled modules. Vite serves them in dev and copies them to dist/ on build.
// Dev port 5174 to avoid clashing with the dashboard (5173).
//
// Multi-page: index.html (marketing) + docs.html (documentation). Both are
// declared as build inputs so `vite build` emits both into dist/.
export default defineConfig({
  server: {
    port: 5174,
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        docs: fileURLToPath(new URL('./docs.html', import.meta.url)),
      },
    },
  },
});
