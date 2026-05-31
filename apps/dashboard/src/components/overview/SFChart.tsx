import { smoothArea, smoothPath, type Point } from '../../utils/chartMath';
import type { StatsResponse, CalibrationResponse } from '../../api/types';
import styles from './overview.module.css';

interface Props {
  stats: StatsResponse;
  calibration: CalibrationResponse;
}

// Port of `drawSF()` from the wireframe prototype. Constants identical.
export function SFChart({ stats, calibration }: Props) {
  const W = 600, H = 200, padL = 32, padR = 8, padT = 14, padB = 24;

  // The wireframe uses a 14-point series. The contract timeseries currently
  // has 13 hourly points — pad with the leading value so the curve still
  // anchors to the left edge with the same visual cadence.
  const series = stats.timeseries;
  const sArr = series.map((p) => p.avg_sufficiency);
  const fArr = series.map((p) => p.avg_faithfulness);
  while (sArr.length < 14) { sArr.unshift(sArr[0]); fArr.unshift(fArr[0]); }

  const min = 0.8, max = 1.0;
  const xStep = (W - padL - padR) / (sArr.length - 1);
  const yScale = (v: number) =>
    H - padB - ((v - min) / (max - min)) * (H - padB - padT);

  const gridLines = [0, 1, 2, 3, 4].map((i) => {
    const v = min + ((max - min) / 4) * i;
    const y = yScale(v);
    return (
      <g key={i}>
        <line className="grid-line" x1={padL} x2={W - padR} y1={y} y2={y} />
        <text className="axis-y" x={padL - 6} y={y + 3} textAnchor="end">
          {v.toFixed(2)}
        </text>
      </g>
    );
  });

  const xLabels = ['-24h', '-18h', '-12h', '-6h', 'now'].map((lbl, i) => (
    <text
      key={lbl}
      className="axis-x"
      x={padL + (i / 4) * (W - padL - padR)}
      y={H - 6}
      textAnchor="middle"
    >
      {lbl}
    </text>
  ));

  const sPts: Point[] = sArr.map((v, i) => [padL + xStep * i, yScale(v)]);
  const fPts: Point[] = fArr.map((v, i) => [padL + xStep * i, yScale(v)]);

  const yT = yScale(calibration.threshold);
  const divergence = Math.abs(stats.avg_faithfulness - stats.avg_sufficiency);

  return (
    <div className={styles.card} id="sf-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>Sufficiency vs Faithfulness</div>
        <div className={styles.cardSub}>avg per hour · last 24h</div>
        <div className={styles.cardLink}>Compare →</div>
      </div>
      <div className={styles.cardLegend}>
        <span className={styles.legendCh}>
          <span className={styles.legendSw} style={{ background: 'var(--po-live)' }} />
          Sufficiency {stats.avg_sufficiency.toFixed(2)}
        </span>
        <span className={styles.legendCh}>
          <span className={styles.legendSw} style={{ background: '#76936A' }} />
          Faithfulness {stats.avg_faithfulness.toFixed(2)}
        </span>
        <span className={`${styles.legendCh} ${styles.legendRight}`}>
          divergence: {divergence.toFixed(2)}
        </span>
      </div>
      <div className={styles.cardBody}>
        <svg className={styles.chart} viewBox="0 0 600 200" preserveAspectRatio="none">
          {gridLines}
          {xLabels}

          <path d={smoothArea(sPts, yScale(min))} fill="rgba(163,177,138,0.10)" />
          <path
            d={smoothPath(sPts)}
            stroke="var(--po-live)"
            strokeWidth="1.8"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {sPts.map((p, i) => (
            <circle key={`s-${i}`} cx={p[0]} cy={p[1]} r={1.8} fill="var(--po-live)" />
          ))}

          <path
            d={smoothPath(fPts)}
            stroke="#76936A"
            strokeWidth="1.8"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {fPts.map((p, i) => (
            <circle key={`f-${i}`} cx={p[0]} cy={p[1]} r={1.8} fill="#76936A" />
          ))}

          <line
            x1={padL}
            x2={W - padR}
            y1={yT}
            y2={yT}
            stroke="#7c828c"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
          />
          <text
            className="axis-y"
            x={W - padR}
            y={yT - 4}
            textAnchor="end"
            style={{ fill: '#7c828c' }}
          >
            threshold {calibration.threshold.toFixed(2)}
          </text>
        </svg>
      </div>
    </div>
  );
}
