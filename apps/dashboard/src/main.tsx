import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/tokens.css';
import './styles/reset.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      // Keep inactive query data cached for 10 min so navigating between pages
      // (Traces ↔ Heals ↔ Overview) serves cached data instantly instead of a
      // fresh "Loading…" on every visit.
      gcTime: 10 * 60_000,
      // In dev, fail fast so "stuck loading" surfaces as a visible error
      // (3-retry default makes 404s look like infinite spinners).
      retry: import.meta.env.DEV ? 0 : 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
