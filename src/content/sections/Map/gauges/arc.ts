// docs/site.md section 7.6. The dial geometry shared by the flight data
// dock's gauges: a 270 degree arc that starts at 135 degrees (bottom left,
// angles clockwise from the positive x axis as SVG draws them) and runs
// clockwise, leaving the 90 degree gap at the bottom.

export const ARC_START_DEG = 135;
export const ARC_SWEEP_DEG = 270;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function point(deg: number, r: number, cx: number, cy: number): string {
  const rad = (deg * Math.PI) / 180;
  return `${round(cx + r * Math.cos(rad))} ${round(cy + r * Math.sin(rad))}`;
}

// The SVG path of the arc from 135 degrees to 135 + 270 * frac degrees,
// frac clamped to 0 to 1. The large arc flag is set once the sweep passes
// half a circle.
export function arcPath(frac: number, r: number, cx: number, cy: number): string {
  const sweep = ARC_SWEEP_DEG * clamp01(frac);
  const large = sweep > 180 ? 1 : 0;
  const start = point(ARC_START_DEG, r, cx, cy);
  const end = point(ARC_START_DEG + sweep, r, cx, cy);
  return `M ${start} A ${r} ${r} 0 ${large} 1 ${end}`;
}

// The length of the full 270 degree arc at radius r.
export function arcLength(r: number): number {
  return (r * ARC_SWEEP_DEG * Math.PI) / 180;
}
