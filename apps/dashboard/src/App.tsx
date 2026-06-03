import { Routes, Route, useLocation } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { WorkbenchDrawer } from './components/workbench/WorkbenchDrawer';
import { useAuth } from './hooks/useAuth';
import Landing from './routes/Landing';
import Login from './routes/Login';
import Onboarding from './routes/Onboarding';
import Placeholder from './routes/Placeholder';
import ProjectsHome from './routes/ProjectsHome';
import TodayOverview from './routes/TodayOverview';
import TraceExplorer from './routes/TraceExplorer';
import Analytics from './routes/Analytics';
import FailureCells from './routes/FailureCells';
import TraceDetail from './routes/TraceDetail';
import Heals from './routes/Heals';
import Settings from './routes/Settings';

export default function App() {
  return (
    <>
      <AppRoutes />
      {/* Persistent Workbench — fixed to the bottom of every authenticated page,
          mounted once here so its open/tab state survives navigation. */}
      <GlobalWorkbench />
    </>
  );
}

/* The Workbench dev drawer is global (Stripe "Developers"-bar model): a fixed
   collapsed strip on every signed-in page; click to bring the panel up. Hidden
   pre-auth (login). */
function GlobalWorkbench() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user || pathname === '/login') return null;
  return <WorkbenchDrawer />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public landing page (marketing/hero) at the root. */}
      <Route path="/" element={<Landing />} />
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

      {/* Project Overview — the "Today" command-center (B2 glow) + Workbench.
          Demo data for now; ProjectOverview.tsx kept for backend wiring later. */}
      <Route
        path="/projects/:slug"
        element={
          <RequireAuth>
            <TodayOverview />
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

      {/* Failure Cells — the 2×3 grounded/complete taxonomy over time. */}
      <Route
        path="/projects/:slug/analytics/cells"
        element={
          <RequireAuth>
            <FailureCells />
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

      {/* Heals — per-project queue + detail. */}
      <Route
        path="/projects/:slug/heals"
        element={
          <RequireAuth>
            <Heals />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/:slug/heals/:cardId"
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
