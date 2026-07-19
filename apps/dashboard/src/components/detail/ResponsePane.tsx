import styles from './detail.module.css';
import type { Claim, FaithfulnessJudgment } from '../../api/types';

interface Props {
  response: string;
  claims: Claim[];
  faithfulness: FaithfulnessJudgment[];
  /** Claim ids that don't map to any sub-question (Ri with no Qi) — "extra" padding. */
  extraClaimIds: number[];
  hoveredChunkRank: number | null;
  onClaimHover: (claimId: number | null) => void;
}

function formatChunkRefs(ranks: number[]): string {
  if (ranks.length === 0) return '→ no chunk';
  return '→ ' + ranks.map((r) => `chunk #${r}`).join(', ');
}

export function ResponsePane({
  response,
  claims,
  faithfulness,
  extraClaimIds,
  hoveredChunkRank,
  onClaimHover,
}: Props) {
  const judgmentByClaim = new Map(faithfulness.map((f) => [f.claim_id, f]));
  const extraSet = new Set(extraClaimIds);
  const grounded = faithfulness.filter((f) => f.verdict === 'Y').length;
  const ungrounded = faithfulness.length - grounded;
  // Conversational claims (encouragement, closers, meta) carry no factual claim
  // and are not graded — shown neutrally so they don't read as failures.
  const conversational = claims.filter((c) => c.claim_type === 'conversational').length;

  return (
    <div className={styles.pane}>
      <div className={styles.paneH}>
        <span className={styles.paneTag}>R</span>
        <h3>Response</h3>
        <span className={styles.paneMeta}>
          {claims.length} claims · {grounded} grounded · {ungrounded} ungrounded
          {extraSet.size > 0 && ` · ${extraSet.size} extra`}
          {conversational > 0 && ` · ${conversational} conversational`}
        </span>
      </div>
      {claims.length === 0 ? (
        <p className={styles.rText}>{response || '(empty response)'}</p>
      ) : (
        <p className={styles.rText}>
          {claims.map((claim, idx) => {
            const isConversational = claim.claim_type === 'conversational';
            const f = judgmentByClaim.get(claim.id);
            const ok = f?.verdict === 'Y';
            const isExtra = extraSet.has(claim.id) && !isConversational;
            const cited =
              hoveredChunkRank != null &&
              (f?.grounding_chunk_ranks ?? []).includes(hoveredChunkRank);
            const className = [
              styles.claim,
              isConversational ? styles.claimConversational : ok ? styles.claimOk : styles.claimBad,
              isExtra ? styles.claimExtra : '',
              cited ? styles.claimOutline : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <span key={claim.id}>
                <span
                  className={className}
                  data-claim-id={claim.id}
                  onMouseEnter={() => onClaimHover(claim.id)}
                  onMouseLeave={() => onClaimHover(null)}
                >
                  {claim.text}
                  <span className={styles.claimBadge}>R{idx}</span>
                  {isConversational && <span className={styles.claimConvTag}>conversational</span>}
                  {isExtra && <span className={styles.claimExtraTag}>extra</span>}
                  {(f || isExtra || isConversational) && (
                    <span className={styles.tip}>
                      {isConversational ? (
                        <span className={styles.tipConv}>
                          Conversational — not scored. Encouragement or phrasing with no factual
                          claim to ground, so it can’t be a hallucination.
                        </span>
                      ) : (
                        <>
                          {f && (
                            <span className={styles.tipHead}>
                              <span
                                className={`${styles.tipV} ${
                                  ok ? styles.tipVOk : styles.tipVNo
                                }`}
                              >
                                {f.verdict}
                              </span>
                              Faithfulness
                              <span className={styles.tipChunkRef}>
                                {formatChunkRefs(f.grounding_chunk_ranks)}
                              </span>
                            </span>
                          )}
                          {isExtra && (
                            <span className={styles.tipExtra}>
                              Extra claim — doesn’t answer any sub-question (not asked for).
                            </span>
                          )}
                          {f?.reasoning}
                        </>
                      )}
                    </span>
                  )}
                </span>
                {idx < claims.length - 1 ? ' ' : null}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
