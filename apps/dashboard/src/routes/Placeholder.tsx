import { Link } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';

type Props = {
  title: string;
  subtitle?: string;
};

export default function Placeholder({ title, subtitle }: Props) {
  return (
    <ProjectShell variant="workspace" active="projects">
      <div className="po-page-error">
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{title}</h1>
        {subtitle ? <p style={{ margin: '8px 0 0', maxWidth: 560 }}>{subtitle}</p> : null}
        <Link
          to="/projects"
          className="po-btn"
          style={{ display: 'inline-flex', alignItems: 'center', marginTop: 20, textDecoration: 'none' }}
        >
          Back to projects
        </Link>
      </div>
    </ProjectShell>
  );
}
