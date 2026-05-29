import styles from './shell.module.css';

interface Props {
  label?: string;
  endpoint?: string;
  uptime?: string;
}

export function LiveStatus({
  label = 'Connected',
  endpoint = 'SSE · /api/events',
  uptime = '↑ 12m',
}: Props) {
  return (
    <div className={styles.foot}>
      <span className={styles.liveDot} />
      <span>
        <span className={styles.footLbl}>{label}</span>
        <br />
        <span className={styles.footMeta}>{endpoint}</span>
      </span>
      <span className={styles.footSub}>{uptime}</span>
    </div>
  );
}
