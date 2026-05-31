import { smoothArea, smoothPath, type Point } from '../../utils/chartMath';
import type { StatsResponse } from '../../api/types';
import styles from './overview.module.css';

interface Props {
  stats: StatsResponse;
}

// Port of `drawVolume()` from the wireframe prototype. All constants — viewBox,
// padding, maxV, colors — match the prototype verbatim.
export function VolumeChart({ stats }: Props) {
  const W = 600, H = 200, padL = 32, padR = 8, padT = 14, padB = 24;
  const data = stats.timeseries;
  const maxV = 180;
  const xStep = (W - padL - padR) / (data.length - 1);
  const yScale = (v: number) => H - padB - (v / maxV) * (H - padB - padT);

  const gridLines = [0, 1, 2, 3].map((i) => {
    const v = (maxV / 3) * i;
    const y = yScale(v);
    return (
      <g key={i}>
        <line className="grid-line" x1={padL} x2={W - padR} y1={y} y2={y} />
        <text className="axis-y" x={padL - 6} y={y + 3} textAnchor="end">
          {Math.round(v)}
        </text>
      </g>
    );
  });

  const xLabels = data.map((d, i) =>
    i % 2 === 0 ? (
      <text
        key={i}
        className="axis-x"
        x={padL + xStep * i}
        y={H - 6}
        textAnchor="middle"
      >
        {d.bucket}
      </text>
    ) : null,
  );

  const okPts: Point[] = data.map((d, i) => [padL + xStep * i, yScale(d.ok)]);
  const peak = data.reduce((m, d) => Math.max(m, d.ok), 0);

  const lastX = padL + xStep * (data.length - 1);

  return (
    <div className={styles.card} id="vol-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>Trace volume</div>
        <div className={styles.cardSub}>hourly · last 24h</div>
        <div className={styles.cardLink}>Open chart →</div>
      </div>
      <div className={styles.cardLegend}>
        <span className={styles.legendCh}>
          <span className={styles.legendSw} style={{ background: 'var(--accent)' }} />
          completed
        </span>
        <span className={styles.legendCh}>
          <span className={styles.legendSw} style={{ background: 'var(--cell-cu)' }} />
          failed
        </span>
        <span className={`${styles.legendCh} ${styles.legendRight}`}>peak {peak} / hr</span>
      </div>
      <div className={styles.cardBody}>
        <svg className={styles.chart} viewBox="0 0 600 200" preserveAspectRatio="none">
          {gridLines}
          {xLabels}

          <path d={smoothArea(okPts, yScale(0))} fill="rgba(163,177,138,0.16)" />
          <path
            d={smoothPath(okPts)}
            stroke="var(--po-live)"
            strokeWidth="1.8"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {data.map((d, i) => {
            const x = padL + xStep * i;
            const h = (d.failed / maxV) * (H - padB - padT);
            return (
              <rect
                key={`bar-${i}`}
                x={x - 2}
                y={H - padB - h}
                width={4}
                height={h}
                fill="var(--cell-cu)"
                rx={1}
              />
            );
          })}

          {data.map((d, i) => (
            <circle
              key={`pt-${i}`}
              cx={padL + xStep * i}
              cy={yScale(d.ok)}
              r={2}
              fill="var(--po-live)"
            />
          ))}

          <line
            x1={lastX}
            x2={lastX}
            y1={padT}
            y2={H - padB}
            stroke="var(--po-live)"
            strokeDasharray="2 3"
            strokeOpacity={0.5}
          />
        </svg>
      </div>
    </div>
  );
}
