import { defineConfig } from 'vite';

// Marketing site (veralithai.com). A single self-contained static page —
// no framework, no bundled modules. Vite just serves it in dev and copies
// it to dist/ on build. Dev port 5174 to avoid clashing with the dashboard
// (5173).
export default defineConfig({
  server: {
    port: 5174,
    host: true,
  },
});
