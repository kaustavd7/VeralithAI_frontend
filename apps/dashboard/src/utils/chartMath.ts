// Ported verbatim from the wireframe prototype (`Veralith Dashboard.html` <script>).
// Catmull-Rom → cubic Bezier smoothing. Tension 0.18 — do not change without
// re-checking pixel parity against the prototype.

export type Point = [number, number];

export function smoothPath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const t = 0.18;
    const cp1x = p1[0] + (p2[0] - p0[0]) * t;
    const cp1y = p1[1] + (p2[1] - p0[1]) * t;
    const cp2x = p2[0] - (p3[0] - p1[0]) * t;
    const cp2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function smoothArea(points: Point[], baselineY: number): string {
  if (points.length < 2) return '';
  const linePath = smoothPath(points);
  return (
    linePath +
    ` L ${points[points.length - 1][0]} ${baselineY} L ${points[0][0]} ${baselineY} Z`
  );
}
