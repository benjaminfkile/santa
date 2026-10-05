// docs/site.md section 7.6. The frame the flight gauge's dial draws on: a
// 270 degree track arc (absent with `track={false}`), three marks at the
// arc's start, top and end, an optional value arc filled to `fraction`,
// the value and unit in the middle, the label under the dial, and children
// for extra marks drawn in the 54 by 54 viewBox. The value arc is the full
// arc dashed to its fraction, so a new fraction sweeps through the CSS
// transition on stroke-dashoffset.

import type { ReactNode } from "react";
import { arcLength, arcPath } from "./arc";
import * as styles from "./GaugeFrame.module.css";

export const GAUGE_SIZE = 54;
export const GAUGE_CENTER = GAUGE_SIZE / 2;
export const GAUGE_RADIUS = 21;

// The marks at the arc's start (135 degrees), top, and end (405 degrees).
export const TICKS = "M12.9 41.1l2.1-2.1M27 7v3M41.1 41.1l-2.1-2.1";

export type GaugeFrameProps = {
  value: string;
  unit: string;
  label: string;
  // 0 to 1, clamped; null or absent draws no value arc.
  fraction?: number | null;
  testId: string;
  // false leaves out the 270 degree track and its marks, for a dial that
  // draws its own face.
  track?: boolean;
  children?: ReactNode;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// The value sits in a 54 unit box, so a long reading has to come down to
// fit: "58" gets the full size, "4.1k" a little less, "312° NW" enough
// less that it still clears the dial's walls.
export function valueFontSize(value: string): number {
  const n = value.length;
  if (n <= 3) return 16;
  if (n === 4) return 14;
  if (n === 5) return 12;
  if (n === 6) return 10.5;
  return 9;
}

export function GaugeFrame({ value, unit, label, fraction = null, testId, track = true, children }: GaugeFrameProps) {
  const length = arcLength(GAUGE_RADIUS);
  const full = arcPath(1, GAUGE_RADIUS, GAUGE_CENTER, GAUGE_CENTER);
  const hasArc = fraction !== null && Number.isFinite(fraction);
  const offset = hasArc ? length * (1 - clamp01(fraction)) : length;
  const ariaLabel = [label, value, unit].filter((part) => part !== "").join(" ");
  return (
    <svg
      className={styles.gauge}
      viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
      role="img"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {track ? <path className={styles.track} d={full} data-testid={`${testId}-track`} /> : null}
      {track ? <path className={styles.tick} d={TICKS} data-testid={`${testId}-ticks`} /> : null}
      {hasArc ? (
        <path
          className={styles.arc}
          d={full}
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={offset}
          data-testid={`${testId}-arc`}
        />
      ) : null}
      {children}
      <text
        className={styles.value}
        x={GAUGE_CENTER}
        y={29}
        fontSize={valueFontSize(value)}
        textAnchor="middle"
        data-testid={`${testId}-value`}
      >
        {value}
      </text>
      <text className={styles.unit} x={GAUGE_CENTER} y={36} textAnchor="middle" data-testid={`${testId}-unit`}>
        {unit}
      </text>
      <text className={styles.label} x={GAUGE_CENTER} y={49} textAnchor="middle" data-testid={`${testId}-label`}>
        {label.toUpperCase()}
      </text>
    </svg>
  );
}
