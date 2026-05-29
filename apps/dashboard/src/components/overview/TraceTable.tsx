import { useNavigate, useParams } from 'react-router-dom';
import { CELL_META } from '../../utils/cellMeta';
import {
  formatFraction,
  formatLatency,
  formatMoney,
  formatRelative,
} from '../../utils/format';
import type { TraceListItem, FailureCell } from '../../api/types';
import styles from './overview.module.css';

interface Props {
  traces: TraceListItem[];
  total: number;
  cellFilter: FailureCell | null;
  onClearFilter: () => void;
  freshIds?: Set<number>;
}

export function TraceTable({
  traces,
  total,
  cellFilter,
  onClearFilter,
  freshIds,
}: Props) {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={styles.tracebox} id="recent-traces">
      <div className={styles.traceboxHead}>
        <h3>Recent traces</h3>
        <span className={styles.chip}>
          <span className={styles.chipLd} />
          live
        </span>
        {cellFilter && (
          <span className={styles.chip}>
            filter: <span className={styles.queryCell}>{cellFilter}</span>
            <button
              className={styles.chipClose}
              onClick={(e) => {
                e.stopPropagation();
                onClearFilter();
              }}
            >
              ×
            </button>
          </span>
        )}
        <span className={styles.traceboxMeta}>
          sort: newest · page 1 / {pages}
        </span>
        <span className={styles.traceboxSpacer} />
        <button className={styles.btn}>Columns</button>
        <button className={styles.btn}>Filters</button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ width: 46 }}>#</th>
            <th>Query</th>
            <th style={{ width: 180 }}>Failure cell</th>
            <th style={{ width: 80 }}>S</th>
            <th style={{ width: 80 }}>F</th>
            <th style={{ width: 80 }}>Claims</th>
            <th style={{ width: 90 }}>Latency</th>
            <th style={{ width: 80 }}>Cost</th>
            <th style={{ width: 80 }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {traces.map((t) => {
            const meta = t.failure_cell ? CELL_META[t.failure_cell] : null;
            const fresh = freshIds?.has(t.id);
            const s = t.sufficiency_fraction;
            const f = t.faithfulness_fraction;
            return (
              <tr
                key={t.id}
                className={fresh ? styles.tableFresh : ''}
                onClick={() => navigate(`/projects/${slug}/traces/${t.id}`)}
              >
                <td className={styles.idCell}>#{t.id}</td>
                <td className={styles.queryCell}>{t.query}</td>
                <td>
                  {meta ? (
                    <span className={styles.cellChip} style={{ background: meta.color }}>
                      {meta.label}
                    </span>
                  ) : (
                    <span className={`${styles.cellChip} ${styles.cellChipMuted}`}>—</span>
                  )}
                </td>
                <td className={styles.metricCell}>
                  <span style={s != null && s < 0.8 ? { color: 'var(--cell-cu)' } : undefined}>
                    {formatFraction(s)}
                  </span>
                </td>
                <td className={styles.metricCell}>
                  <span style={f != null && f < 0.8 ? { color: 'var(--cell-cu)' } : undefined}>
                    {formatFraction(f)}
                  </span>
                </td>
                <td className={styles.metricCell}>{t.n_claims}</td>
                <td className={styles.metricCell}>{formatLatency(t.latency_ms_total)}</td>
                <td className={styles.metricCell}>
                  {t.cost_usd != null ? formatMoney(t.cost_usd) : '—'}
                </td>
                <td className={`${styles.metricCell} ${styles.metaFg4}`}>
                  {formatRelative(t.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
