import type { ReactNode } from 'react';
import styles from './overview.module.css';

// Generic banner — content is driven by props (per §13 pre-commitment).
// Phase 0.3 will reuse this surface for cross-trace pattern alerts; do NOT
// hardcode copy here.
export interface BannerMetaItem {
  label: ReactNode;       // e.g. <>+5</> or "0.85"
  value: ReactNode;       // e.g. "critical" or "threshold"
}

export interface BannerAction {
  label: string;
  onClick: () => void;
}

interface Props {
  glyph?: ReactNode;            // defaults to "!"
  message: ReactNode;           // full message body
  meta?: BannerMetaItem[];
  action?: BannerAction;
  marginTop?: boolean;
}

export function DiagnosisBanner({
  glyph = '!',
  message,
  meta = [],
  action,
  marginTop = false,
}: Props) {
  return (
    <div className={`${styles.banner} ${marginTop ? styles.bannerTop : ''}`}>
      <div className={styles.bannerGlyph}>{glyph}</div>
      <div className={styles.bannerText}>{message}</div>
      <div className={styles.bannerMeta}>
        {meta.map((m, i) => (
          <span key={i}>
            <b>{m.label}</b> {m.value}
          </span>
        ))}
        {action && (
          <button className={styles.bannerBtn} onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
