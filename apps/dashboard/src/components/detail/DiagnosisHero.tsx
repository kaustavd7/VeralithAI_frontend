import { useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './detail.module.css';
import { CELL_META } from '../../utils/cellMeta';
import { tracesPath } from '../../lib/nav';
import type { Diagnosis, Suggestion } from '../../api/types';

interface Props {
  diagnosis: Diagnosis;
  suggestion: Suggestion;
  traceId: string;
  // Backend's authoritative honest-abstention flag; falls back to a local
  // heuristic when undefined (pre-deploy).
  isAbstention?: boolean;
}

const CELL_MEANINGS: Record<string, string> = {
  complete_grounded:
    'The response covered every sub-question and every claim is supported by retrieved context. Healthy.',
  complete_ungrounded:
    'The response answered every sub-question, but some claims are not grounded in retrieved context — the generator filled gaps with fabrication.',
  incomplete_grounded:
    'The response is grounded where it spoke, but missed sub-questions. Retrieval likely lacks coverage for parts of the query.',
  incomplete_ungrounded:
    'The response missed parts of the question, and fabricated facts within what it did answer. This is the worst-case cell — both retrieval and generation failed at once.',
  extra_grounded:
    'The response answered the question and added grounded extras. Often acceptable but worth checking for relevance.',
  extra_ungrounded:
    'The response added ungrounded extras beyond the question. The generator strayed from retrieved context.',
};

const CELL_SEVERITY: Record<string, string> = {
  complete_grounded:     'HEALTHY',
  complete_ungrounded:   'UNGROUNDED',
  incomplete_grounded:   'INCOMPLETE',
  incomplete_ungrounded: 'CRITICAL · worst-case',
  extra_grounded:        'EXTRA',
  extra_ungrounded:      'EXTRA · ungrounded',
};

// Traffic-light severity hue per cell: green = healthy, amber/yellow =
// grounded-but-imperfect, red/dark-red = ungrounded (hallucination). `ink` is
// the readable pill text colour on that hue.
const CELL_TINT: Record<string, { hue: string; ink: string }> = {
  complete_grounded:     { hue: 'var(--cell-cg)', ink: '#06150e' }, // green
  incomplete_grounded:   { hue: 'var(--cell-ig)', ink: '#1d1503' }, // amber
  extra_grounded:        { hue: 'var(--cell-eg)', ink: '#181504' }, // yellow
  complete_ungrounded:   { hue: 'var(--cell-cu)', ink: '#ffffff' }, // red
  extra_ungrounded:      { hue: 'var(--cell-eu)', ink: '#ffffff' }, // red
  incomplete_ungrounded: { hue: 'var(--cell-iu)', ink: '#ffffff' }, // dark red
};
const CELL_TINT_FALLBACK = { hue: 'var(--po-line-strong)', ink: '#ffffff' } as const;

function buildMarkdown(traceId: string, cell: string, s: Suggestion): string {
  const items = s.actions.map((a) => `- ${a}`).join('\n');
  return `## Veralith trace #${traceId.slice(0, 8)} — ${cell}

**Suggestion:** ${s.title}

${s.body}

${items}`;
}

// Render an action string with inline `code` spans coerced to <code>.
function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

// Fallback so an unknown/missing failure_cell can't throw on .color/.label.
const CELL_META_FALLBACK = {
  label: 'unknown_cell',
  color: 'var(--po-line-strong)',
  ink: '#ffffff',
  short: '?',
} as const;

export function DiagnosisHero({ diagnosis, suggestion, traceId, isAbstention }: Props) {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [toast, setToast] = useState(false);
  const meta = CELL_META[diagnosis.failure_cell] ?? CELL_META_FALLBACK;
  const meaning = CELL_MEANINGS[diagnosis.failure_cell] ?? '';
  const severity = CELL_SEVERITY[diagnosis.failure_cell] ?? '';
  const tint = CELL_TINT[diagnosis.failure_cell] ?? CELL_TINT_FALLBACK;

  function goToCellTraces() {
    navigate(tracesPath(slug, diagnosis.failure_cell));
  }

  const sufFrac = diagnosis.sufficiency_fraction;
  const fFrac = diagnosis.faithfulness_fraction;
  const sufClass =
    sufFrac < 0.5 ? styles.sfVBad : sufFrac < 1 ? styles.sfVWarn : '';
  const fClass =
    fFrac < 0.5 ? styles.sfVBad : fFrac < 1 ? styles.sfVWarn : '';

  const groundedClaims = Math.round(fFrac * diagnosis.n_claims);
  const passedSubs = Math.round(sufFrac * diagnosis.n_sub_questions);

  // Honest abstention: the model correctly declined an unanswerable query
  // instead of hallucinating. Prefer the backend's authoritative flag (robust to
  // refusals phrased as ungrounded meta-claims — which the local sufficiency/
  // faithfulness heuristic misses); fall back to the heuristic pre-deploy.
  // Surfaced as a positive note so this cell doesn't read as a bug.
  const isHonestAbstention =
    isAbstention !== undefined
      ? isAbstention
      : diagnosis.n_sub_questions > 0 &&
        sufFrac === 0 &&
        fFrac === 1 &&
        diagnosis.failure_cell !== 'complete_grounded';

  async function handleCopy() {
    const md = buildMarkdown(traceId, diagnosis.failure_cell, suggestion);
    try {
      await navigator.clipboard.writeText(md);
      setToast(true);
      window.setTimeout(() => setToast(false), 1800);
    } catch {
      // clipboard denied — silent fail
    }
  }

  return (
    <>
      <div className={styles.diag} style={{ '--diag-tint': tint.hue } as CSSProperties}>
        <div className={styles.diagLeft}>
          <span
            className={styles.cellPill}
            style={{ background: tint.hue, color: tint.ink, cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            title={`View ${meta.label} traces`}
            onClick={goToCellTraces}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                goToCellTraces();
              }
            }}
          >
            {severity}
          </span>
          <div className={styles.cellName}>{meta.label}</div>
          <div className={styles.cellMeaning}>{meaning}</div>
          {isHonestAbstention && (
            <div className={styles.abstentionNote}>
              <span className={styles.abstentionBadge}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6.2l2.3 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Honest abstention
              </span>
              Retrieval had nothing for this query and the model declined instead of
              fabricating — desired RAG-safety behaviour, not a hallucination.
            </div>
          )}
          {!isHonestAbstention && diagnosis.sufficiency_level === 'low' && (
            <div className={styles.retrievalNote}>
              <span className={styles.retrievalBadge}>Retrieval gap</span>
              Sufficiency is low — the retrieved context didn’t cover the query.
              That’s the root cause here; the <b>{meta.label}</b> cell is secondary.
              Fix retrieval (coverage / top-K / chunking) first.
            </div>
          )}
          <div className={styles.sfPair}>
            <div className={styles.sfBox}>
              <div className={styles.sfL}>Sufficiency</div>
              <div className={`${styles.sfV} ${sufClass}`}>{sufFrac.toFixed(2)}</div>
              <div className={styles.sfSub}>
                {passedSubs} / {diagnosis.n_sub_questions} sub-questions · level{' '}
                {diagnosis.sufficiency_level.toUpperCase()}
              </div>
            </div>
            <div className={styles.sfBox}>
              <div className={styles.sfL}>Faithfulness</div>
              <div className={`${styles.sfV} ${fClass}`}>{fFrac.toFixed(2)}</div>
              <div className={styles.sfSub}>
                {groundedClaims} / {diagnosis.n_claims} claims grounded
              </div>
            </div>
          </div>
        </div>

        <div className={styles.diagRight}>
          <div className={styles.diagTitle}>{suggestion.title}</div>
          <div className={styles.diagBody}>{suggestion.body}</div>
          <div className={styles.actions}>
            <div className={styles.actionsHead}>
              <span>Suggested actions</span>
              <button type="button" className={styles.copyBtn} onClick={handleCopy}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect
                    x="3"
                    y="3"
                    width="6"
                    height="6"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M5 3V2a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H9"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    fill="none"
                  />
                </svg>
                Copy as Markdown
              </button>
            </div>
            <ol>
              {suggestion.actions.map((a, i) => (
                <li key={i}>{renderInlineCode(a)}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      <div className={`${styles.toast} ${toast ? styles.toastShow : ''}`}>
        Copied {suggestion.actions.length} actions to clipboard.
      </div>
    </>
  );
}
