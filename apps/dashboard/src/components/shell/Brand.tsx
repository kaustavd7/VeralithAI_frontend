import styles from './shell.module.css';

interface Props {
  env?: string;
}

export function Brand({ env = 'local' }: Props) {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark}>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <path
            d="M4 13.5 L7.5 6.5 L13 5 L18.5 9.5 L18 15 L11.5 19 L5 17.5 Z"
            fill="var(--accent)"
            fillOpacity="0.16"
            stroke="var(--accent)"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 6.5 L11 11 L18.5 9.5 M11 11 L11.5 19 M11 11 L5 17.5"
            stroke="var(--accent)"
            strokeWidth="1.4"
            strokeOpacity="0.55"
            fill="none"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={styles.brandName}>veralith</span>
      <span className={styles.brandEnv}>{env}</span>
    </div>
  );
}
