import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Proxy target for /v1/* in dev. Defaults to local backend; override with
  // VITE_API_PROXY_TARGET=https://api.veralithai.com to hit the deployed
  // backend without tripping browser CORS (Vite forwards server-side).
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/v1': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
