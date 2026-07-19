import styles from './detail.module.css';
import type { Claim, FaithfulnessJudgment } from '../../api/types';

interface Props {
  response: string;
  claims: Claim[];
  faithfulness: FaithfulnessJudgment[];
  /** Claim ids that don't map to any sub-question (Ri with no Qi) — "extra". */
  extraClaimIds: number[];
  hoveredChunkRank: number | null;
  onClaimHover: (claimId: number | null) => void;
}

/* Highlight by EXCEPTION: a grounded, on-topic claim reads as ordinary prose so
   the eye lands on the problems. Only unsupported (red wavy), extra (amber
   dashed), and conversational (dim) claims are marked; hover any for reasoning. */
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
  const conversational = claims.filter((c) => c.claim_type === 'conversational').length;

  // Exception-framed summary: lead with problems, or "all grounded" when clean.
  const parts: string[] = [];
  if (ungrounded) parts.push(`${ungrounded} unsupported`);
  if (extraSet.size) parts.push(`${extraSet.size} extra`);
  if (conversational) parts.push(`${conversational} not scored`);
  const summary = parts.length ? parts.join(' · ') : 'all grounded';

  return (
    <div className={styles.pane}>
      <div className={styles.paneH}>
        <span className={styles.paneTag}>R</span>
        <h3>Response</h3>
        <span className={styles.paneMeta}>
          {claims.length} claims · {summary}
        </span>
      </div>
      {claims.length === 0 ? (
        <p className={styles.rProse}>{response || '(empty response)'}</p>
      ) : (
        <p className={styles.rProse}>
          {claims.map((claim, idx) => {
            const isConversational = claim.claim_type === 'conversational';
            const f = judgmentByClaim.get(claim.id);
            const isUngrounded = !isConversational && f?.verdict === 'N';
            const isExtra = extraSet.has(claim.id) && !isConversational;
            const flagged = isUngrounded || isExtra || isConversational;
            const cited =
              hoveredChunkRank != null &&
              (f?.grounding_chunk_ranks ?? []).includes(hoveredChunkRank);
            const className = [
              styles.claim,
              isUngrounded ? styles.claimBad : '',
              isExtra ? styles.claimExtra : '',
              isConversational ? styles.claimConversational : '',
              cited ? styles.claimCited : '',
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
                  {flagged && (
                    <span className={styles.tip}>
                      {isUngrounded && (
                        <span className={styles.tipBad}>
                          Unsupported — not grounded in the retrieved context.
                        </span>
                      )}
                      {isExtra && (
                        <span className={styles.tipExtra}>
                          Extra — doesn’t answer the question (not asked for).
                        </span>
                      )}
                      {isConversational && (
                        <span className={styles.tipConv}>
                          Conversational — no factual claim to check, so it isn’t scored.
                        </span>
                      )}
                      {f?.reasoning}
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
