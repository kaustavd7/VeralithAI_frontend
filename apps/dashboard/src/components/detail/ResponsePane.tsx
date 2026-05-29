import styles from './detail.module.css';
import type { Claim, FaithfulnessJudgment } from '../../api/types';

interface Props {
  claims: Claim[];
  faithfulness: FaithfulnessJudgment[];
  hoveredChunkRank: number | null;
  onClaimHover: (claimId: number | null) => void;
}

function formatChunkRefs(ranks: number[]): string {
  if (ranks.length === 0) return '→ no chunk';
  return '→ ' + ranks.map((r) => `chunk #${r}`).join(', ');
}

export function ResponsePane({
  claims,
  faithfulness,
  hoveredChunkRank,
  onClaimHover,
}: Props) {
  const judgmentByClaim = new Map(faithfulness.map((f) => [f.claim_id, f]));
  const grounded = faithfulness.filter((f) => f.verdict === 'Y').length;
  const ungrounded = faithfulness.length - grounded;

  return (
    <div className={styles.pane}>
      <div className={styles.paneH}>
        <span className={styles.paneTag}>R</span>
        <h3>Response</h3>
        <span className={styles.paneMeta}>
          {claims.length} claims · {grounded} grounded · {ungrounded} ungrounded
        </span>
      </div>
      <p className={styles.rText}>
        {claims.map((claim, idx) => {
          const f = judgmentByClaim.get(claim.id);
          const ok = f?.verdict === 'Y';
          const cited =
            hoveredChunkRank != null &&
            (f?.grounding_chunk_ranks ?? []).includes(hoveredChunkRank);
          const className = [
            styles.claim,
            ok ? styles.claimOk : styles.claimBad,
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
                {f && (
                  <span className={styles.tip}>
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
                    {f.reasoning}
                  </span>
                )}
              </span>
              {idx < claims.length - 1 ? ' ' : null}
            </span>
          );
        })}
      </p>
    </div>
  );
}
