import styles from './shell.module.css';

interface Props {
  workspace?: string;
  projectSlug: string;
  here?: string;
}

export function TopBar({ workspace = 'workspace', projectSlug, here = 'overview' }: Props) {
  return (
    <div className={styles.topbar}>
      <div className={styles.crumbs}>
        <span>{workspace}</span>
        <span className={styles.crumbsSep}>/</span>
        <span>{projectSlug}</span>
        <span className={styles.crumbsSep}>/</span>
        <span className={styles.crumbsHere}>{here}</span>
      </div>

      <div className={styles.topActions}>
        <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`} title="Docs">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 3h7l3 3v7H3z" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10 3v3h3" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
        <button className={styles.btn}>Export JSONL</button>
        <button className={`${styles.btn} ${styles.btnPrimary}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          New trace
        </button>
      </div>
    </div>
  );
}
