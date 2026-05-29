import { CELL_META, type CellName } from '../../utils/cellMeta';
import type { StatsResponse, FailureCell } from '../../api/types';
import { formatInt } from '../../utils/format';
import styles from './overview.module.css';

interface Props {
  stats: StatsResponse;
  onCellClick?: (cell: FailureCell) => void;
}

// Wireframe order — by descending share.
const DISPLAY_ORDER: CellName[] = [
  'complete_grounded',
  'incomplete_grounded',
  'extra_grounded',
  'complete_ungrounded',
  'extra_ungrounded',
  'incomplete_ungrounded',
];

export function CellDistribution({ stats, onCellClick }: Props) {
  const total = stats.total_traces || 1;

  return (
    <div className={styles.card} id="dist-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>Failure cell distribution</div>
        <div className={styles.cardSub}>
          last 24h · {formatInt(stats.total_traces)} traces
        </div>
        <div className={styles.cardLink}>View all →</div>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.distRows} style={{ marginTop: 8 }}>
          {DISPLAY_ORDER.map((cell) => {
            const count = stats.by_cell[cell] ?? 0;
            const pct = (count / total) * 100;
            const meta = CELL_META[cell];
            return (
              <div
                key={cell}
                className={styles.distRow}
                onClick={() => onCellClick?.(cell)}
              >
                <div className={styles.distName}>
                  <span className={styles.distSw} style={{ background: meta.color }} />
                  {meta.label}
                </div>
                <div className={styles.distBar}>
                  <i style={{ width: `${pct}%`, background: meta.color }} />
                </div>
                <div className={styles.distCount}>
                  {formatInt(count)}
                  <span className={styles.distPct}>{pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
