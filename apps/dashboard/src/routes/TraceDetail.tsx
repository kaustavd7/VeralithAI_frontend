import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProjectShell } from '../components/projectShell/ProjectShell';
import { useProjects } from '../hooks/useProjects';
import { healsPath } from '../lib/nav';
import detailStyles from '../components/detail/detail.module.css';
import { DiagnosisHero } from '../components/detail/DiagnosisHero';
import { TraceHealCards } from '../components/detail/TraceHealCards';
import { QueryPane } from '../components/detail/QueryPane';
import { ResponsePane } from '../components/detail/ResponsePane';
import { RetrievedChunks } from '../components/detail/RetrievedChunks';
import { PerClaimTable } from '../components/detail/PerClaimTable';
import { HealHistory } from '../components/detail/HealHistory';
import { useTrace } from '../hooks/useTrace';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { TraceDetail as TraceDetailType } from '../api/types';

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

  const shell = (body: React.ReactNode, traceForActions?: TraceDetailType) => (
    <ProjectShell slug={slug} active="traces" project={projectName}>
      <div className={detailStyles.page}>
        <DetailActionBar
          slug={slug}
          traceId={id}
          trace={traceForActions}
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
    (<>
      {(trace.heal_sessions?.length ?? 0) > 0 && (
        <HealHistory sessions={trace.heal_sessions ?? []} />
      )}

      {evaluated && trace.diagnosis ? (
        <DiagnosisHero
          diagnosis={trace.diagnosis}
          suggestion={trace.suggestion}
          traceId={trace.id}
          isAbstention={trace.is_abstention}
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

      {/* The fix: heal card(s) this trace is evidence for — or, for a failure
          not yet clustered, a hint on how heal cards form. */}
      {(trace.heal_cards?.length ?? 0) > 0 ? (
        <TraceHealCards slug={slug} cards={trace.heal_cards ?? []} />
      ) : (
        evaluated &&
        trace.diagnosis &&
        trace.diagnosis.failure_cell !== 'complete_grounded' && (
          <div className={detailStyles.section}>
            <div className={detailStyles.healHint}>
              This trace isn’t in a heal card yet — Veralith groups recurring failures
              into a heal card automatically. See the suggested actions above, or the{' '}
              <Link to={healsPath(slug)}>heal queue</Link>.
            </div>
          </div>
        )
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
            response={trace.response}
            claims={trace.claims}
            faithfulness={trace.faithfulness}
            extraClaimIds={trace.completeness?.extra_claim_ids ?? []}
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

    </>),
    trace,
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
/* Build a Markdown briefing of the trace to paste into Claude Code. */
function traceMarkdown(traceId: string, t: TraceDetailType): string {
  const d = t.diagnosis;
  const chunks = (t.context_chunks ?? [])
    .map((c, i) => `${i + 1}. ${c.text}`)
    .join('\n');
  const diag = d
    ? [
        `- Failure cell: \`${d.failure_cell}\``,
        `- Sufficiency: ${d.sufficiency_fraction.toFixed(2)}`,
        `- Faithfulness: ${d.faithfulness_fraction.toFixed(2)}`,
        `- Honest abstention: ${t.is_abstention ? 'yes' : 'no'}`,
      ].join('\n')
    : '- Not evaluated yet.';
  return (
    `# Veralith trace #${traceId.slice(0, 8)}\n\n` +
    `## Query\n${t.query}\n\n` +
    `## Response\n${t.response}\n\n` +
    `## Retrieved context (${t.context_chunks?.length ?? 0} chunks)\n${chunks || '_none_'}\n\n` +
    `## Veralith diagnosis\n${diag}\n\n` +
    `Explain why this trace was classified this way, whether the classification ` +
    `looks correct, and what a good fix in my RAG pipeline would be.`
  );
}

function DetailActionBar({
  slug,
  traceId,
  trace,
  onBack,
}: {
  slug: string;
  traceId: string;
  trace?: TraceDetailType;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const reeval = useMutation({
    mutationFn: () => api.reevaluateTrace(slug, traceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trace', slug, traceId] }),
  });

  async function copyMarkdown() {
    if (!trace) return;
    try {
      await navigator.clipboard.writeText(traceMarkdown(traceId, trace));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can still select the text elsewhere */
    }
  }

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
        {(() => {
          const cards = trace?.heal_cards ?? [];
          if (cards.length === 0) return null;
          const fixIcon = (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10.6 2.4a3 3 0 0 0-3.8 3.8L2 11l3 3 4.8-4.8a3 3 0 0 0 3.8-3.8l-1.9 1.9-1.3-1.3 1.9-1.9z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          );
          if (cards.length === 1) {
            return (
              <Link
                to={healsPath(slug, cards[0].id)}
                className={`${detailStyles.btn} ${detailStyles.btnFix}`}
                title="Open the heal card that fixes this trace"
              >
                {fixIcon}
                View fix
              </Link>
            );
          }
          return (
            <button
              type="button"
              className={`${detailStyles.btn} ${detailStyles.btnFix}`}
              onClick={() =>
                document.getElementById('trace-fix')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              title={`${cards.length} heal cards reference this trace`}
            >
              {fixIcon}
              View fixes ({cards.length})
            </button>
          );
        })()}
        <button
          type="button"
          className={detailStyles.btn}
          onClick={() => reeval.mutate()}
          disabled={reeval.isPending}
          title="Drop the current evaluation and re-run the judges"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M10 4a4 4 0 1 0 .5 3.5M10 4V1.5M10 4H7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {reeval.isPending ? 'Re-evaluating…' : 'Re-evaluate'}
        </button>
        <button
          type="button"
          className={detailStyles.btn}
          onClick={copyMarkdown}
          disabled={!trace}
          title="Copy a Markdown briefing of this trace to paste into Claude Code"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="3" y="3" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 3V2a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H9" stroke="currentColor" strokeWidth="1.3" fill="none" />
          </svg>
          {copied ? 'Copied ✓' : 'Copy as Markdown'}
        </button>
      </div>
    </div>
  );
}
