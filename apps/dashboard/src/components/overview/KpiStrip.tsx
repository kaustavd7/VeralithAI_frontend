import { formatInt } from '../../utils/format';
import type { StatsResponse } from '../../api/types';
import styles from './overview.module.css';

interface Props {
  stats: StatsResponse;
  onSelect?: (target: { jumpTo: string; cellFilter: string | null }) => void;
}

type DeltaKind = 'up' | 'down' | 'flat';

function delta(kind: DeltaKind, text: string) {
  const cls =
    kind === 'up'   ? styles.deltaUp :
    kind === 'down' ? styles.deltaDown :
                      styles.deltaFlat;
  return <span className={`${styles.totDelta} ${cls}`}>{text}</span>;
}

export function KpiStrip({ stats, onSelect }: Props) {
  const traces24h = Math.round(
    (stats.total_traces * stats.deltas.total_traces_pct_24h) / 100,
  );
  const healthyPctVal = (stats.healthy_rate * 100).toFixed(1);
  const sufDelta = stats.deltas.avg_sufficiency_delta_24h;
  const faithDelta = stats.deltas.avg_faithfulness_delta_24h;

  return (
    <div className={styles.totals}>
      <button
        type="button"
        className={styles.tot}
        onClick={() => onSelect?.({ jumpTo: '#recent-traces', cellFilter: null })}
      >
        <span className={styles.totLbl}>Total traces</span>
        <span className={styles.totVal}>{formatInt(stats.total_traces)}</span>
        {delta('up', `↑ ${formatInt(traces24h)} in last 24h`)}
        <span className={styles.arrow}>→</span>
      </button>

      <button
        type="button"
        className={styles.tot}
        onClick={() => onSelect?.({ jumpTo: '#recent-traces', cellFilter: 'complete_grounded' })}
      >
        <span className={styles.totLbl}>Healthy rate</span>
        <span className={styles.totVal}>
          {healthyPctVal}
          <span className={styles.totUnit}>%</span>
        </span>
        {delta('up', `↑ ${stats.deltas.healthy_rate_pp_24h.toFixed(1)} pts vs yesterday`)}
        <span className={styles.arrow}>→</span>
      </button>

      <button
        type="button"
        className={styles.tot}
        onClick={() => onSelect?.({ jumpTo: '#sf-card', cellFilter: null })}
      >
        <span className={styles.totLbl}>Avg sufficiency</span>
        <span className={styles.totVal}>{stats.avg_sufficiency.toFixed(2)}</span>
        {sufDelta === 0
          ? delta('flat', '→ stable')
          : delta(sufDelta > 0 ? 'up' : 'down',
              `${sufDelta > 0 ? '↑' : '↓'} ${Math.abs(sufDelta).toFixed(2)} vs yesterday`)}
        <span className={styles.arrow}>→</span>
      </button>

      <button
        type="button"
        className={styles.tot}
        onClick={() => onSelect?.({ jumpTo: '#sf-card', cellFilter: null })}
      >
        <span className={styles.totLbl}>Avg faithfulness</span>
        <span className={styles.totVal}>{stats.avg_faithfulness.toFixed(2)}</span>
        {faithDelta === 0
          ? delta('flat', '→ stable')
          : delta(faithDelta > 0 ? 'up' : 'down',
              `${faithDelta > 0 ? '↑' : '↓'} ${Math.abs(faithDelta).toFixed(2)} vs yesterday`)}
        <span className={styles.arrow}>→</span>
      </button>
    </div>
  );
}
