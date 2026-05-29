import styles from './detail.module.css';

interface Props {
  latencyMs: Record<string, number>;
  costUsd: number | null;
}

export function LatencyFooter({ latencyMs, costUsd }: Props) {
  const entries = Object.entries(latencyMs);
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 0) || 1;
  const totalSec = entries.reduce((s, [, v]) => s + v, 0) / 1000;

  return (
    <div className={styles.foot}>
      <div>
        <div className={styles.sectionHead} style={{ margin: '0 0 12px' }}>
          <h2 style={{ fontSize: 11 }}>Phase latencies</h2>
          <span className={styles.sectionSub}>total {totalSec.toFixed(2)} s</span>
        </div>
        <div className={styles.lat}>
          {entries.map(([nm, ms]) => {
            const h = Math.max(8, Math.round((ms / max) * 110));
            return (
              <div key={nm} className={styles.latPh}>
                <span className={styles.latMs}>{(ms / 1000).toFixed(2)}s</span>
                <div className={styles.latBar} style={{ height: h }}>
                  <i style={{ height: '100%' }} />
                </div>
                <span className={styles.latNm}>{nm}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.cost}>
        <div className={styles.sectionHead} style={{ margin: '0 0 12px' }}>
          <h2 style={{ fontSize: 11 }}>Cost & phases</h2>
        </div>
        {entries.map(([nm, ms]) => (
          <div key={nm} className={styles.costRow}>
            <span>{nm}</span>
            <b>{(ms / 1000).toFixed(2)} s</b>
          </div>
        ))}
        <div className={`${styles.costRow} ${styles.costTotal}`}>
          <span>Total</span>
          <b className={styles.mono}>
            {costUsd != null ? `$${costUsd.toFixed(4)}` : '—'}
          </b>
        </div>
      </div>
    </div>
  );
}
