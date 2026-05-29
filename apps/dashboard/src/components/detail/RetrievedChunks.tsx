import styles from './detail.module.css';
import type { ContextChunk, FaithfulnessJudgment } from '../../api/types';

interface Props {
  chunks: ContextChunk[];
  faithfulness: FaithfulnessJudgment[];
  hoveredClaimId: number | null;
  onChunkHover: (rank: number | null) => void;
}

function citedByLabel(rank: number, faithfulness: FaithfulnessJudgment[]): string[] {
  const refs: string[] = [];
  faithfulness.forEach((f, idx) => {
    if (f.grounding_chunk_ranks.includes(rank)) refs.push(`R${idx}`);
  });
  return refs;
}

export function RetrievedChunks({
  chunks,
  faithfulness,
  hoveredClaimId,
  onChunkHover,
}: Props) {
  const bestScore = chunks.reduce((m, c) => Math.max(m, c.score ?? 0), 0);
  const worstScore = chunks.reduce(
    (m, c) => (c.score != null && c.score < m ? c.score : m),
    1,
  );
  const hoveredJudgment = faithfulness.find((f) => f.claim_id === hoveredClaimId);

  return (
    <details className={styles.collDetails} open>
      <summary>
        <div className={styles.collHead}>
          <svg
            className={styles.collChev}
            width="10"
            height="10"
            viewBox="0 0 10 10"
          >
            <path
              d="M3 2l4 3-4 3"
              stroke="currentColor"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <h3>Retrieved context</h3>
          <span className={styles.collMeta}>
            {chunks.length} chunks · top_k = {chunks.length} · best similarity{' '}
            {bestScore.toFixed(2)} · worst {worstScore.toFixed(2)}
          </span>
        </div>
      </summary>
      <div className={styles.chunks}>
        {chunks.map((chunk) => {
          const cites = citedByLabel(chunk.rank, faithfulness);
          const cited = cites.length > 0;
          const litByHover =
            hoveredJudgment?.grounding_chunk_ranks.includes(chunk.rank) ?? false;
          const rankClass = [
            styles.chunkRank,
            cited ? styles.chunkRankCited : '',
            litByHover ? styles.chunkRankHovered : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={chunk.rank}
              className={styles.chunk}
              onMouseEnter={() => onChunkHover(chunk.rank)}
              onMouseLeave={() => onChunkHover(null)}
            >
              <div className={rankClass}>#{chunk.rank}</div>
              <div>
                <div className={styles.chunkHead}>
                  <span className={styles.chunkSrc}>{chunk.source ?? 'unknown'}</span>
                  <span
                    className={`${styles.chunkPill} ${cited ? '' : styles.chunkPillMiss}`}
                  >
                    {cited ? `cited by ${cites.join(', ')}` : 'not cited'}
                  </span>
                  <span className={styles.chunkScore}>
                    similarity {chunk.score != null ? chunk.score.toFixed(2) : '—'}
                  </span>
                </div>
                <div className={styles.chunkText}>{chunk.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
