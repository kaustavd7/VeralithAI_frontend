import { useId } from 'react';
import '../../styles/brand.css';

/* Veralith brand — a faceted emerald "V" gem (vera + lith = "true stone") on a
   circular stone tile. VGem is the bare gem (animatable); BrandMark is the static
   logo; BrandLoader draws the gem in as a loading state. */

export function VGem({ size = 64, building = false }: { size?: number; building?: boolean }) {
  const uid = 'vg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={'vgem' + (building ? ' vg-draw' : '')}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={uid + 'l'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ff0c6" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id={uid + 'r'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#0c9466" />
        </linearGradient>
        <linearGradient id={uid + 's'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8af0c8" />
          <stop offset="100%" stopColor="#2bbf86" />
        </linearGradient>
      </defs>
      <g className="vg-facet vg-left">
        <path d="M8 14 L20 14 L32 38 L32 54 Z" fill={`url(#${uid}l)`} />
      </g>
      <g className="vg-facet vg-right">
        <path d="M56 14 L44 14 L32 38 L32 54 Z" fill={`url(#${uid}r)`} />
      </g>
      <path className="vg-seam" d="M32 38 L32 54" stroke="#0b5e45" strokeWidth="0.9" opacity="0.45" />
      {building && (
        <path
          className="vg-stroke"
          d="M14 14 L32 46 L50 14"
          fill="none"
          stroke={`url(#${uid}s)`}
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
        />
      )}
      <path
        className="vg-shine"
        d="M16.5 13.5 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

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

export function BrandLoader({ size = 64, label }: { size?: number; label?: string }) {
  return (
    <div className="brand-loader" role="status" aria-live="polite">
      <div className="logo-tile is-build" style={{ width: size, height: size }}>
        <VGem size={Math.round(size * 0.62)} building />
      </div>
      {label ? <span className="brand-loader-label">{label}</span> : null}
    </div>
  );
}
