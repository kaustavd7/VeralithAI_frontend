import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from '../components/shell/Sidebar';
import shellStyles from '../components/shell/shell.module.css';
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
  const traceId = Number(id);
  const query = useTrace(slug, traceId);
  const [activeNav, setActiveNav] = useState('traces');

  // Cross-highlight state: hover a claim OR a chunk (mutually exclusive).
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
    <div className={shellStyles.app}>
      <Sidebar activeId={activeNav} onSelect={(i) => setActiveNav(i.id)} />
      <main className={shellStyles.main}>
        <DetailTopBar slug={slug} traceId={traceId} onBack={() => navigate(`/projects/${slug}`)} />
        {body}
      </main>
    </div>
  );

  if (query.isLoading) {
    return shell(<div style={{ padding: 28, color: 'var(--fg-3)' }}>Loading trace…</div>);
  }
  if (query.isError || !query.data) {
    return shell(
      <div style={{ padding: 28, color: 'var(--cell-cu)' }}>
        Failed to load trace #{id}.
      </div>,
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

interface TopBarProps {
  slug: string;
  traceId: number;
  onBack: () => void;
}

function DetailTopBar({ slug, traceId, onBack }: TopBarProps) {
  return (
    <div className={detailStyles.topbar}>
      <div className={detailStyles.crumbs}>
        <a onClick={onBack}>workspace</a>
        <span className={detailStyles.crumbsSep}>/</span>
        <a onClick={onBack}>{slug}</a>
        <span className={detailStyles.crumbsSep}>/</span>
        <a onClick={onBack}>traces</a>
        <span className={detailStyles.crumbsSep}>/</span>
        <span className={detailStyles.crumbsHere}>#{traceId}</span>
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
        <button type="button" className={detailStyles.btn}>Re-evaluate</button>
        <button type="button" className={detailStyles.btn}>Flag false positive</button>
        <HealButton />
        <button type="button" className={`${detailStyles.btn} ${detailStyles.btnPrimary}`}>
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
        </button>
      </div>
    </div>
  );
}
