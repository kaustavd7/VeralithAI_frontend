import styles from './detail.module.css';
import type { SubQuestion, SufficiencyJudgment } from '../../api/types';

interface Props {
  query: string;
  subQuestions: SubQuestion[];
  sufficiency: SufficiencyJudgment[];
}

function verdictLabel(judgment: SufficiencyJudgment | undefined): {
  text: string;
  cls: string;
} {
  if (!judgment) return { text: 'PENDING', cls: '' };
  if (judgment.verdict === 'Y') return { text: 'PASS', cls: '' };
  if (judgment.supporting_chunk_ranks.length === 0) {
    return { text: 'UNCOVERED', cls: styles.verdictMissing };
  }
  return { text: 'FAIL', cls: styles.verdictNo };
}

export function QueryPane({ query, subQuestions, sufficiency }: Props) {
  const judgmentBySub = new Map(sufficiency.map((s) => [s.sub_question_id, s]));
  return (
    <div className={styles.pane}>
      <div className={styles.paneH}>
        <span className={styles.paneTag}>Q</span>
        <h3>Query</h3>
        <span className={styles.paneMeta}>
          {subQuestions.length} sub-questions · {query.length} chars
        </span>
      </div>
      <p className={styles.qText}>{query}</p>

      {subQuestions.length > 0 && (
        <div className={styles.qSub}>
          <div className={styles.qSubH}>Sub-questions (decomposed by judge)</div>
          {subQuestions.map((sq, idx) => {
            const j = judgmentBySub.get(sq.id);
            const v = verdictLabel(j);
            const rowCls = [
              styles.subq,
              j?.verdict === 'Y' ? styles.subqPass : styles.subqFail,
            ].join(' ');
            const supporting =
              j && j.supporting_chunk_ranks.length > 0
                ? j.supporting_chunk_ranks.map((r) => `#${r}`).join(', ')
                : 'none';
            return (
              <div key={sq.id} className={rowCls}>
                <span className={styles.subqIx}>Q{idx}</span>
                <div>
                  <div className={styles.subqT}>{sq.text}</div>
                  {j && (
                    <>
                      <div className={styles.subqR}>
                        <b>Judge:</b> {j.reasoning}
                      </div>
                      <div className={styles.subqR}>
                        <b>Supporting:</b> {supporting}
                      </div>
                    </>
                  )}
                </div>
                <span className={`${styles.verdict} ${v.cls}`}>{v.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
