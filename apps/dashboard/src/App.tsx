import { Routes, Route, Navigate } from 'react-router-dom';
import Placeholder from './routes/Placeholder';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects/demo" replace />} />
      <Route path="/login" element={<Placeholder title="Login" subtitle="Phase 1 — Supabase Auth UI lands here." />} />
      <Route path="/onboarding" element={<Placeholder title="Onboarding" subtitle="Phase 1 — first project + API key reveal." />} />
      <Route path="/projects/:slug" element={<Placeholder title="Overview" subtitle="Phase 2 — KPI strip, charts, trace table." />} />
      <Route path="/projects/:slug/traces/:id" element={<Placeholder title="Trace Detail" subtitle="Phase 3 — diagnosis hero, Q/R, claim highlights." />} />
      <Route path="*" element={<Placeholder title="Not found" subtitle="The page you were looking for does not exist." />} />
    </Routes>
  );
}
