import type { ReactNode } from 'react';
import { ProjectSidebar } from './ProjectSidebar';
import { ProjectTopbar } from './ProjectTopbar';
import { useSidebarMode } from '../../lib/sidebarMode';
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
  env?: 'production' | 'staging' | 'local';
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
  env = 'local',
  workspace = 'workspace',
  mainClass,
  drawer,
  children,
}: Props) {
  const [mode] = useSidebarMode();

  return (
    <div className="shell" data-sb={mode}>
      <ProjectTopbar project={project} env={env} workspace={workspace} />
      <div className="shell-body">
        <ProjectSidebar active={active} slug={slug} variant={variant} />
        <main className={'shell-main' + (mainClass ? ' ' + mainClass : '')}>{children}</main>
        {drawer}
      </div>
    </div>
  );
}
