import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import Login from './routes/Login';
import Onboarding from './routes/Onboarding';
import Placeholder from './routes/Placeholder';
import ProjectOverview from './routes/ProjectOverview';
import TraceExplorer from './routes/TraceExplorer';
import Analytics from './routes/Analytics';
import TraceDetail from './routes/TraceDetail';

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

      {/* Project Overview — the new landing page for each project. */}
      <Route
        path="/projects/:slug"
        element={
          <RequireAuth>
            <ProjectOverview />
          </RequireAuth>
        }
      />

      {/* Trace Explorer — triage table. */}
      <Route
        path="/projects/:slug/traces"
        element={
          <RequireAuth>
            <TraceExplorer />
          </RequireAuth>
        }
      />

      {/* Legacy dense analytics dashboard, preserved at its own URL. */}
      <Route
        path="/projects/:slug/analytics"
        element={
          <RequireAuth>
            <Analytics />
          </RequireAuth>
        }
      />

      <Route
        path="/projects/:slug/traces/:id"
        element={
          <RequireAuth>
            <TraceDetail />
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
