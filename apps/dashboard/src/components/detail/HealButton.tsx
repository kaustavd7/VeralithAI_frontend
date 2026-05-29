import styles from './detail.module.css';

// §13 pre-commitment — Phase 0.2 renders the placeholder; Phase 0.2.5 flips
// only this file to wire it to the heal flow. Do not refactor the surface.
export function HealButton() {
  return (
    <button
      type="button"
      className={`${styles.btn} ${styles.btnDisabled}`}
      disabled
      title="Available in v0.2.5"
    >
      🔧 Heal with Claude Code
      <span className={styles.healBadge}>v0.2.5</span>
    </button>
  );
}
