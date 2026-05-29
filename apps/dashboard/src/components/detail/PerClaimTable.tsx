import styles from './detail.module.css';
import type { Claim, FaithfulnessJudgment } from '../../api/types';

interface Props {
  claims: Claim[];
  faithfulness: FaithfulnessJudgment[];
}

export function PerClaimTable({ claims, faithfulness }: Props) {
  const byClaim = new Map(faithfulness.map((f) => [f.claim_id, f]));
  return (
    <div className={styles.claimList}>
      {claims.map((claim, idx) => {
        const f = byClaim.get(claim.id);
        const ok = f?.verdict === 'Y';
        const grounding =
          f && f.grounding_chunk_ranks.length > 0
            ? f.grounding_chunk_ranks.length === 1
              ? `chunk #${f.grounding_chunk_ranks[0]}`
              : `chunks ${f.grounding_chunk_ranks.map((r) => `#${r}`).join(', ')}`
            : '—';
        return (
          <div key={claim.id} className={styles.claimRow}>
            <div className={styles.claimIx}>R{idx}</div>
            <div className={styles.claimCt}>
              {claim.text}
              {f && <span className={styles.claimWhy}>{f.reasoning}</span>}
            </div>
            <div className={styles.claimGrounding}>
              Grounded by
              <br />
              <b>{grounding}</b>
            </div>
            <div className={styles.claimV}>
              <span
                className={`${styles.verdict} ${ok ? '' : styles.verdictNo}`}
              >
                {f?.verdict ?? '—'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
