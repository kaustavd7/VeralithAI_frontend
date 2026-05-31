import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import Login from './routes/Login';
import Onboarding from './routes/Onboarding';
import Placeholder from './routes/Placeholder';
import ProjectsHome from './routes/ProjectsHome';
import ProjectOverview from './routes/ProjectOverview';
import TraceExplorer from './routes/TraceExplorer';
import Analytics from './routes/Analytics';
import TraceDetail from './routes/TraceDetail';
import Heals from './routes/Heals';
import Settings from './routes/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/login" element={<Login />} />

      {/* Projects Home — post-login landing. Lists the user's projects;
          empty-state CTA links to /onboarding for the first project. */}
      <Route
        path="/projects"
        element={
          <RequireAuth>
            <ProjectsHome />
          </RequireAuth>
        }
      />

      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />

      {/* Project Overview — single-project landing. */}
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

      {/* Heals — global queue + detail (cross-project). */}
      <Route
        path="/heals"
        element={
          <RequireAuth>
            <Heals />
          </RequireAuth>
        }
      />
      <Route
        path="/heals/:cardId"
        element={
          <RequireAuth>
            <Heals />
          </RequireAuth>
        }
      />

      {/* Settings — global profile + plan + sign-out. */}
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <Settings />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/profile"
        element={
          <RequireAuth>
            <Settings />
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
