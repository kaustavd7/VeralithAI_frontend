import { useParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import { useCalibration } from '../hooks/useOverviewData';
import { LoadingState, ErrorState } from '../components/StateViews';
import '../styles/project-shell.css';
import '../styles/project-page.css';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/* Calibration — the sufficiency judge's calibrated grounding threshold and how
   it was derived. Read-only; data from /v1/projects/{id}/calibration. */
export default function Calibration() {
  const { slug = '' } = useParams<{ slug: string }>();
  const projects = useProjects();
  const project = projects.data?.projects.find((p) => p.slug === slug || p.id === slug);
  const projectName = project?.name ?? slug;
  const cal = useCalibration(slug);

  return (
    <ProjectShell slug={slug} active="calibration" project={projectName}>
      <div className="po-page">
        <div className="page-header">
          <h1 className="page-title">Calibration</h1>
          <div className="page-sub">
            The sufficiency judge marks a trace grounded when its score clears a calibrated threshold —
            learned from this project's own successful traces.
          </div>
        </div>

        {cal.isLoading ? (
          <LoadingState label="Loading calibration…" />
        ) : cal.isError || !cal.data ? (
          <ErrorState
            message={cal.error instanceof Error ? cal.error.message : 'Could not load calibration.'}
            onRetry={() => cal.refetch()}
          />
        ) : (
          <div className="cal-grid">
            <div className="po-card cal-hero">
              <div className="cal-hero-label">Active threshold</div>
              <div className="cal-hero-num po-mono">{cal.data.threshold.toFixed(2)}</div>
              <span className={'cal-badge ' + (cal.data.using_fallback ? 'is-fallback' : 'is-calibrated')}>
                {cal.data.using_fallback ? 'Using fallback' : 'Calibrated'}
              </span>
            </div>

            <div className="po-card cal-detail">
              <div className="cal-detail-head">How it was derived</div>
              <p className="cal-prose">
                {cal.data.using_fallback ? (
                  <>
                    Not enough successful traces yet to calibrate, so a safe fallback of{' '}
                    <b>{cal.data.fallback_value.toFixed(2)}</b> is in use. The threshold auto-tunes once more
                    grounded traces accumulate.
                  </>
                ) : (
                  <>
                    Computed from <b>{cal.data.n_successful_traces.toLocaleString()}</b> successful traces,
                    taking the <b>{cal.data.percentile}th</b> percentile of their sufficiency scores.
                  </>
                )}
              </p>
              <div className="cal-rows">
                <div className="cal-row">
                  <span className="cal-row-l">Successful traces</span>
                  <span className="cal-row-v po-mono">{cal.data.n_successful_traces.toLocaleString()}</span>
                </div>
                <div className="cal-row">
                  <span className="cal-row-l">Percentile</span>
                  <span className="cal-row-v po-mono">{cal.data.percentile}th</span>
                </div>
                <div className="cal-row">
                  <span className="cal-row-l">Fallback value</span>
                  <span className="cal-row-v po-mono">{cal.data.fallback_value.toFixed(2)}</span>
                </div>
                <div className="cal-row">
                  <span className="cal-row-l">Last computed</span>
                  <span className="cal-row-v po-mono">{fmtDate(cal.data.computed_at)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProjectShell>
  );
}
