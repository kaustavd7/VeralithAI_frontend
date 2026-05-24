import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import Login from './routes/Login';
import Onboarding from './routes/Onboarding';
import Placeholder from './routes/Placeholder';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/onboarding" replace />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />

      <Route
        path="/projects/:slug"
        element={
          <RequireAuth>
            <Placeholder
              title="Overview"
              subtitle="Phase 2 — KPI strip, charts, trace table."
            />
          </RequireAuth>
        }
      />

      <Route
        path="/projects/:slug/traces/:id"
        element={
          <RequireAuth>
            <Placeholder
              title="Trace Detail"
              subtitle="Phase 3 — diagnosis hero, Q/R, claim highlights."
            />
          </RequireAuth>
        }
      />

      <Route
        path="*"
        element={
          <Placeholder title="Not found" subtitle="The page you were looking for does not exist." />
        }
      />
    </Routes>
  );
}
