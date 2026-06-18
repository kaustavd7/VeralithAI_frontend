import { useId } from 'react';
import '../../styles/brand.css';

/* Veralith brand — a faceted emerald "V" gem (vera + lith = "true stone") on a
   circular stone tile (BrandMark, the logo/favicon), plus the polished
   pebble-pile app loader (BrandLoader). */

export function BrandMark({
  size = 24,
  tile = true,
  className,
}: {
  size?: number;
  tile?: boolean;
  className?: string;
}) {
  const uid = 'bm' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <radialGradient id={uid + 't'} cx="32" cy="24" r="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1d2c23" />
          <stop offset="100%" stopColor="#0c120e" />
        </radialGradient>
        <linearGradient id={uid + 'l'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ff0c6" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id={uid + 'r'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#0c9466" />
        </linearGradient>
      </defs>
      {tile && <circle cx="32" cy="32" r="31" fill={`url(#${uid}t)`} stroke="#2a3a30" strokeWidth="1" />}
      <g transform="translate(32 32) scale(0.8) translate(-32 -32)">
        <path d="M8 14 L20 14 L32 38 L32 54 Z" fill={`url(#${uid}l)`} />
        <path d="M56 14 L44 14 L32 38 L32 54 Z" fill={`url(#${uid}r)`} />
        <path d="M32 38 L32 54" stroke="#0b5e45" strokeWidth="0.9" opacity="0.45" />
        <path
          d="M16.5 13.5 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3 Z"
          fill="#ffffff"
          opacity="0.85"
        />
      </g>
    </svg>
  );
}

/* The app loading state — pebbles drop, squash on impact, and pile into a heap. */
export function BrandLoader({ label }: { label?: string }) {
  return (
    <div className="pebble-loader" role="status" aria-live="polite">
      <div className="pl-box" aria-hidden="true">
        <span className="pl-ground" />
        <span className="pl-stone p1" />
        <span className="pl-stone p2" />
        <span className="pl-stone p3" />
        <span className="pl-stone p4" />
        <span className="pl-stone p5" />
        <span className="pl-stone p6" />
      </div>
      {label ? <span className="pebble-loader-label">{label}</span> : null}
    </div>
  );
}
