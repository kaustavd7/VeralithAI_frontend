import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import detailStyles from '../components/detail/detail.module.css';
import { DiagnosisHero } from '../components/detail/DiagnosisHero';
import { QueryPane } from '../components/detail/QueryPane';
import { ResponsePane } from '../components/detail/ResponsePane';
import { RetrievedChunks } from '../components/detail/RetrievedChunks';
import { PerClaimTable } from '../components/detail/PerClaimTable';
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
    return shell(<TraceDetailSkeleton />);
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

    </>,
  );
}

/* ─────────────────────────────────────────────────────────────
   Loading skeleton — mirrors the hero + query/response layout so the page
   settles in place instead of flashing blank / "Loading…".
   ─────────────────────────────────────────────────────────── */
function Sk({ w, h, style }: { w?: number | string; h?: number; style?: CSSProperties }) {
  return <span className={detailStyles.skBlock} style={{ width: w, height: h, ...style }} />;
}

function TraceDetailSkeleton() {
  const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
  const card: CSSProperties = {
    background: 'var(--po-panel)',
    border: '1px solid var(--po-line)',
    borderRadius: 'var(--po-radius)',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };
  return (
    <>
      <div
        className={detailStyles.diag}
        style={{ '--diag-tint': 'var(--po-fg)' } as CSSProperties}
        aria-hidden="true"
      >
        <div className={detailStyles.diagLeft}>
          <Sk w={96} h={24} style={{ borderRadius: 8 }} />
          <Sk w={'64%'} h={26} />
          <div style={col}>
            <Sk w={'100%'} h={11} />
            <Sk w={'84%'} h={11} />
          </div>
          <div className={detailStyles.sfPair}>
            <div className={detailStyles.sfBox} style={col}>
              <Sk w={58} h={10} />
              <Sk w={62} h={22} />
              <Sk w={'86%'} h={9} />
            </div>
            <div className={detailStyles.sfBox} style={col}>
              <Sk w={66} h={10} />
              <Sk w={62} h={22} />
              <Sk w={'86%'} h={9} />
            </div>
          </div>
        </div>
        <div className={detailStyles.diagRight}>
          <Sk w={'40%'} h={18} />
          <div style={col}>
            <Sk w={'100%'} h={12} />
            <Sk w={'92%'} h={12} />
          </div>
          <Sk w={'100%'} h={66} style={{ borderRadius: 10, marginTop: 4 }} />
        </div>
      </div>

      <div className={detailStyles.section}>
        <div className={detailStyles.sectionHead}>
          <Sk w={170} h={16} />
        </div>
        <div className={detailStyles.qr}>
          {[0, 1].map((i) => (
            <div key={i} style={card}>
              <Sk w={84} h={12} />
              <Sk w={'90%'} h={15} />
              <Sk w={'100%'} h={56} style={{ borderRadius: 8 }} />
              <Sk w={'70%'} h={12} />
            </div>
          ))}
        </div>
      </div>
    </>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
        <div className={detailStyles.crumbs}>
          <a onClick={onBack}>traces</a>
          <span className={detailStyles.crumbsSep}>/</span>
          <span className={detailStyles.crumbsHere} title={traceId}>#{traceId.slice(0, 8)}</span>
        </div>
      </div>
      <div className={detailStyles.topActions}>
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
