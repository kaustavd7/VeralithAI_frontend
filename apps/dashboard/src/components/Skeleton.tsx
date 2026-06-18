import type { CSSProperties, ReactNode } from 'react';
import '../styles/skeleton.css';

/* Shimmer primitives for layout-matched skeletons. Compose these INSIDE the
   page's real container/grid classes so the skeleton occupies the same space as
   the loaded content (smooth, shift-free transition). */

export function Skel({
  w = '100%',
  h = 14,
  r = 6,
  className,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={'skel' + (className ? ' ' + className : '')}
      style={{ width: w, height: h, borderRadius: r, ...style }}
      aria-hidden="true"
    />
  );
}

/* Screen-reader-only loading announcement. The shimmer leaves are all
   aria-hidden, so without this a skeleton would replace the old <LoadingState>'s
   polite "Loading…" announcement with silence. Render ONE of these per page
   skeleton, as a sibling of (not inside) any aria-hidden shimmer wrapper. */
export function SkelStatus({ label = 'Loading…' }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  );
}

/* A stack of text-line shimmers (last line shorter, like a paragraph). */
export function SkelLines({
  count = 3,
  gap = 8,
  lastW = '70%',
  lineH = 11,
}: {
  count?: number;
  gap?: number;
  lastW?: string;
  lineH?: number;
}) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skel key={i} h={lineH} w={i === count - 1 ? lastW : '100%'} />
      ))}
    </span>
  );
}

/* A panel card matching the app's `--po-panel` cards, for skeletons that aren't
   reusing an existing card class. */
export function SkelCard({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--po-panel)',
        border: '1px solid var(--po-line)',
        borderRadius: 'var(--po-radius, 12px)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
