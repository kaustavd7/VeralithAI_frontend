import { CELL_META } from '../../utils/cellMeta';
import { formatRelative } from '../../utils/format';
import type { TraceListItem } from '../../api/types';
import styles from './overview.module.css';

interface Props {
  traces: TraceListItem[];
  onRowClick?: (trace: TraceListItem) => void;
}

// SSE wiring is Phase 5 — this just renders the latest ~7 traces.
export function LiveStream({ traces, onRowClick }: Props) {
  const recent = traces.slice(0, 7);
  return (
    <div className={styles.card} id="live-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>Live trace stream</div>
        <span className={styles.chip}>
          <span className={styles.chipLd} />
          live
        </span>
        <div className={styles.cardLink}>Pause →</div>
      </div>
      <div className={styles.cardBody} style={{ marginTop: 8 }}>
        <div className={styles.stream}>
          {recent.map((t, i) => {
            const meta = t.failure_cell ? CELL_META[t.failure_cell] : null;
            const rowClass = `${styles.streamRow} ${i === 0 ? styles.streamFresh : ''}`;
            return (
              <div key={t.id} className={rowClass} onClick={() => onRowClick?.(t)}>
                {meta ? (
                  <span className={styles.streamCell} style={{ background: meta.color }}>
                    {meta.label}
                  </span>
                ) : (
                  <span className={styles.streamCell} style={{ background: 'transparent', color: 'var(--fg-3)' }}>—</span>
                )}
                <span className={styles.streamQ}>{t.query}</span>
                <span className={styles.streamMet}>
                  S {(t.sufficiency_fraction ?? 0).toFixed(2)} · F{' '}
                  {(t.faithfulness_fraction ?? 0).toFixed(2)}
                </span>
                <span className={styles.streamAgo}>{formatRelative(t.created_at)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
