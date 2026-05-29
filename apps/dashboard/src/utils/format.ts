export function formatMoney(usd: number, fractionDigits = 4): string {
  return `$${usd.toFixed(fractionDigits)}`;
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatPercent(fraction: number, fractionDigits = 1): string {
  return `${(fraction * 100).toFixed(fractionDigits)}%`;
}

export function formatFraction(n: number | null, fractionDigits = 2): string {
  if (n == null) return '—';
  return n.toFixed(fractionDigits);
}

export function formatLatency(ms: number | null): string {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(2)}s`;
}

// "just now" / "12s ago" / "3m ago" / "2h ago" — matches the prototype's labels.
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  const diffMs = now - t;
  if (diffMs < 5_000) return 'just now';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
