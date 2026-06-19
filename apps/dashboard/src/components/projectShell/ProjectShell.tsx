import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ProjectSidebar } from './ProjectSidebar';
import { ProjectTopbar } from './ProjectTopbar';
import { useSidebarMode } from '../../lib/sidebarMode';
import { usePrefetchProjectData } from '../../lib/prefetch';
import '../../styles/project-shell.css';
import '../../styles/project-page.css';

type Props = {
  /** sidebar nav variant: project-scoped tabs, or top-level workspace tabs */
  variant?: 'project' | 'workspace';
  /** active sidebar item id */
  active: string;
  /** present for project pages; omit at the workspace level */
  slug?: string;
  /** project name — when set, the topbar appends the `/ project ⌄` switcher */
  project?: string;
  workspace?: string;
  /** Extra class on `.shell-main` (e.g. a pure-black canvas override). */
  mainClass?: string;
  /** Overlay pinned to the bottom of the content frame (e.g. the Workbench). */
  drawer?: ReactNode;
  children: ReactNode;
};

export function ProjectShell({
  variant = 'project',
  active,
  slug,
  project,
  workspace = 'workspace',
  mainClass,
  drawer,
  children,
}: Props) {
  const [mode] = useSidebarMode();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  // Warm every project page's data on entry so navigating between tabs is instant.
  usePrefetchProjectData(variant === 'project' ? slug ?? '' : '');

  // Close the mobile nav drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell" data-sb={mode}>
      <ProjectTopbar project={project} workspace={workspace} onMenu={() => setNavOpen(true)} />
      <div className="shell-body">
        <ProjectSidebar
          active={active}
          slug={slug}
          variant={variant}
          mobileOpen={navOpen}
          onMobileClose={() => setNavOpen(false)}
        />
        <main className={'shell-main' + (mainClass ? ' ' + mainClass : '')}>{children}</main>
        {drawer}
      </div>
    </div>
  );
}
