import styles from './shell.module.css';

interface Props {
  env?: string;
}

export function Brand({ env = 'local' }: Props) {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 2 L20 18 L2 18 Z" stroke="#6fd6c4" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
          <path d="M11 2 L11 18" stroke="#6fd6c4" strokeWidth="1.4" strokeOpacity="0.45" />
          <path d="M6.5 12 L15.5 12" stroke="#6fd6c4" strokeWidth="1.4" strokeOpacity="0.45" />
        </svg>
      </span>
      <span className={styles.brandName}>veralith</span>
      <span className={styles.brandEnv}>{env}</span>
    </div>
  );
}
