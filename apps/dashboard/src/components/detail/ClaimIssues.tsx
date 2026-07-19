import styles from './detail.module.css';
import type { Claim, FaithfulnessJudgment } from '../../api/types';

interface Props {
  claims: Claim[];
  faithfulness: FaithfulnessJudgment[];
  extraClaimIds: number[];
}

type Issue = {
  idx: number;
  text: string;
  kind: 'unsupported' | 'extra';
  reasoning: string;
};

/* Issues-first: instead of a table of ALL claims, list only the ones worth
   inspecting — unsupported (ungrounded) and extra (unrequested) claims, each
   with the judge's reasoning. Grounded, on-topic claims need no row. */
export function ClaimIssues({ claims, faithfulness, extraClaimIds }: Props) {
  const judgmentByClaim = new Map(faithfulness.map((f) => [f.claim_id, f]));
  const extraSet = new Set(extraClaimIds);

  const issues: Issue[] = [];
  claims.forEach((claim, idx) => {
    if (claim.claim_type === 'conversational') return; // not scored → not an issue
    const f = judgmentByClaim.get(claim.id);
    if (f?.verdict === 'N') {
      issues.push({ idx, text: claim.text, kind: 'unsupported', reasoning: f.reasoning });
    } else if (extraSet.has(claim.id)) {
      issues.push({
        idx,
        text: claim.text,
        kind: 'extra',
        reasoning: 'Doesn’t answer any sub-question of the query — volunteered, not asked for.',
      });
    }
  });

  if (issues.length === 0) {
    return (
      <div className={styles.issuesClean}>
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 6.2l2.3 2.3L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Every claim is grounded and on-topic — nothing to inspect.
      </div>
    );
  }

  return (
    <ul className={styles.issues}>
      {issues.map((iss) => (
        <li key={iss.idx} className={styles.issueRow}>
          <span className={`${styles.issueTag} ${iss.kind === 'unsupported' ? styles.issueTagBad : styles.issueTagExtra}`}>
            {iss.kind}
          </span>
          <div className={styles.issueBody}>
            <div className={styles.issueClaim}>“{iss.text}”</div>
            <div className={styles.issueWhy}>{iss.reasoning}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
