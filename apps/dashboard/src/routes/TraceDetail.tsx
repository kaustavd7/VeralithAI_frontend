import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import detailStyles from '../components/detail/detail.module.css';
import { DiagnosisHero } from '../components/detail/DiagnosisHero';
import { QueryPane } from '../components/detail/QueryPane';
import { ResponsePane } from '../components/detail/ResponsePane';
import { RetrievedChunks } from '../components/detail/RetrievedChunks';
import { PerClaimTable } from '../components/detail/PerClaimTable';
import { LatencyFooter } from '../components/detail/LatencyFooter';
import { HealButton } from '../components/detail/HealButton';
import { HealHistory } from '../components/detail/HealHistory';
import { useTrace } from '../hooks/useTrace';

export default function TraceDetail() {
  const { slug = '', id = '' } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();
  const query = useTrace(slug, id);

  const projects = useProjects();
  const project = useMemo(
    () => projects.data?.projects.find((p) => p.slug === slug || p.id === slug),
    [projects.data, slug],
  );
  const projectName = project?.name ?? slug;

  const [hoveredClaimId, setHoveredClaimId] = useState<number | null>(null);
  const [hoveredChunkRank, setHoveredChunkRank] = useState<number | null>(null);

  function onClaimHover(id: number | null) {
    setHoveredChunkRank(null);
    setHoveredClaimId(id);
  }
  function onChunkHover(rank: number | null) {
    setHoveredClaimId(null);
    setHoveredChunkRank(rank);
  }

  const shell = (body: React.ReactNode) => (
    <ProjectShell slug={slug} active="traces" project={projectName}>
      <div className={detailStyles.page}>
        <DetailActionBar
          traceId={id}
          onBack={() => navigate(`/projects/${slug}/traces`)}
        />
        {body}
      </div>
    </ProjectShell>
  );

  if (query.isLoading) {
    return (
      <ProjectShell slug={slug} active="traces" project={projectName}>
        <div className="po-page-loading">Loading trace…</div>
      </ProjectShell>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ProjectShell slug={slug} active="traces" project={projectName}>
        <div className="po-page-error">Failed to load trace #{id.slice(0, 8)}.</div>
      </ProjectShell>
    );
  }

  const trace = query.data.trace;
  const evaluated = trace.status === 'evaluated' && trace.diagnosis;

  return shell(
    <>
      {(trace.heal_sessions?.length ?? 0) > 0 && (
        <HealHistory sessions={trace.heal_sessions ?? []} />
      )}

      {evaluated && trace.diagnosis ? (
        <DiagnosisHero
          diagnosis={trace.diagnosis}
          suggestion={trace.suggestion}
          traceId={trace.id}
        />
      ) : (
        <div className={detailStyles.empty}>
          <div className={detailStyles.emptyTitle}>Trace is {trace.status}</div>
          <div>
            Judges have not produced a diagnosis yet. This page will update once the
            evaluation completes.
          </div>
        </div>
      )}

      <div className={detailStyles.section}>
        <div className={detailStyles.sectionHead}>
          <h2>Query &amp; Response</h2>
          <span className={detailStyles.sectionSub}>
            claims highlighted by judge verdict · hover any claim for reasoning
          </span>
          <div className={detailStyles.sectionRight}>
            <span className={detailStyles.legendRow}>
              <span>
                <span
                  className={detailStyles.legendSw}
                  style={{
                    background: 'var(--hl-green)',
                    borderBottom: '1.5px solid var(--hl-green-b)',
                  }}
                />
                grounded claim
              </span>
              <span>
                <span
                  className={detailStyles.legendSw}
                  style={{
                    background: 'var(--hl-red)',
                    borderBottom: '1.5px solid var(--hl-red-b)',
                  }}
                />
                ungrounded claim
              </span>
            </span>
          </div>
        </div>

        <div className={detailStyles.qr}>
          <QueryPane
            query={trace.query}
            subQuestions={trace.sub_questions}
            sufficiency={trace.sufficiency}
          />
          <ResponsePane
            claims={trace.claims}
            faithfulness={trace.faithfulness}
            hoveredChunkRank={hoveredChunkRank}
            onClaimHover={onClaimHover}
          />
        </div>
      </div>

      <div className={detailStyles.section}>
        <RetrievedChunks
          chunks={trace.context_chunks}
          faithfulness={trace.faithfulness}
          hoveredClaimId={hoveredClaimId}
          onChunkHover={onChunkHover}
        />
      </div>

      {evaluated && (
        <div className={detailStyles.section}>
          <div className={detailStyles.sectionHead}>
            <h2>Per-claim breakdown</h2>
            <span className={detailStyles.sectionSub}>
              {trace.claims.length} claims · ranked by judge order
            </span>
          </div>
          <PerClaimTable claims={trace.claims} faithfulness={trace.faithfulness} />
        </div>
      )}

      <LatencyFooter latencyMs={trace.latency_ms} costUsd={trace.cost_usd} />
    </>,
  );
}

/* ─────────────────────────────────────────────────────────────
   Detail action bar — sits inside ProjectShell main content.
   ProjectTopbar already shows the workspace/project breadcrumb,
   so this row only carries the trace ID + per-trace actions.
   ─────────────────────────────────────────────────────────── */
function DetailActionBar({
  traceId,
  onBack,
}: {
  traceId: string;
  onBack: () => void;
}) {
  return (
    <div className={detailStyles.topbar}>
      <div className={detailStyles.crumbs}>
        <a onClick={onBack}>traces</a>
        <span className={detailStyles.crumbsSep}>/</span>
        <span className={detailStyles.crumbsHere} title={traceId}>#{traceId.slice(0, 8)}</span>
      </div>
      <div className={detailStyles.topActions}>
        <button
          type="button"
          className={`${detailStyles.btn} ${detailStyles.btnGhost}`}
          onClick={onBack}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M7 2L3 6l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
        {/* Dead actions — no handler/endpoint yet. Gated as disabled "soon"
            stubs (mirrors HealButton) so they aren't interactive no-ops. */}
        <button
          type="button"
          className={`${detailStyles.btn} ${detailStyles.btnDisabled}`}
          disabled
          title="Coming soon"
        >
          Re-evaluate
          <span className={detailStyles.healBadge}>soon</span>
        </button>
        <button
          type="button"
          className={`${detailStyles.btn} ${detailStyles.btnDisabled}`}
          disabled
          title="Coming soon"
        >
          Flag false positive
          <span className={detailStyles.healBadge}>soon</span>
        </button>
        <button
          type="button"
          className={`${detailStyles.btn} ${detailStyles.btnDisabled}`}
          disabled
          title="Coming soon"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3v6h6M3 9l5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Open raw JSON
          <span className={detailStyles.healBadge}>soon</span>
        </button>
        <HealButton />
      </div>
    </div>
  );
}
