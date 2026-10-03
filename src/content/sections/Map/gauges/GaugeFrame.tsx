// docs/site.md section 7.6. The frame every dial in the flight data dock
// draws on: a 270 degree track arc, an optional value arc filled to
// `fraction`, the value and unit in the middle, the label under the dial,
// and children for extra marks drawn in the 54 by 54 viewBox. The value
// arc is the full arc dashed to its fraction, so a new fraction sweeps
// through the CSS transition on stroke-dashoffset.

import type { ReactNode } from "react";
import { arcLength, arcPath } from "./arc";
import * as styles from "./GaugeFrame.module.css";

export const GAUGE_SIZE = 54;
export const GAUGE_CENTER = GAUGE_SIZE / 2;
export const GAUGE_RADIUS = 21;

export type GaugeFrameProps = {
  value: string;
  unit: string;
  label: string;
  // 0 to 1, clamped; null or absent draws no value arc.
  fraction?: number | null;
  testId: string;
  children?: ReactNode;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function GaugeFrame({ value, unit, label, fraction = null, testId, children }: GaugeFrameProps) {
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
      <path className={styles.track} d={full} data-testid={`${testId}-track`} />
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
      <text className={styles.value} x={GAUGE_CENTER} y={28} textAnchor="middle" data-testid={`${testId}-value`}>
        {value}
      </text>
      <text className={styles.unit} x={GAUGE_CENTER} y={36} textAnchor="middle" data-testid={`${testId}-unit`}>
        {unit}
      </text>
      <text className={styles.label} x={GAUGE_CENTER} y={52} textAnchor="middle" data-testid={`${testId}-label`}>
        {label.toUpperCase()}
      </text>
    </svg>
  );
}
