import type { ReactNode } from 'react';
import { ProjectSidebar, type SidebarNavId } from './ProjectSidebar';
import { ProjectTopbar } from './ProjectTopbar';
import '../../styles/project-shell.css';
import '../../styles/project-page.css';

type Props = {
  slug: string;
  active: SidebarNavId;
  project: string;
  env?: 'production' | 'staging' | 'local';
  workspace?: string;
  children: ReactNode;
};

export function ProjectShell({
  slug,
  active,
  project,
  env = 'local',
  workspace = 'workspace',
  children,
}: Props) {
  return (
    <div className="shell">
      <ProjectTopbar project={project} env={env} workspace={workspace} />
      <div className="shell-body">
        <ProjectSidebar active={active} slug={slug} />
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
