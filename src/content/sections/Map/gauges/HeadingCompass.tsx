// docs/site.md section 7.6. The dock's heading slot: a compass rose drawn
// in the gauge frame's children with no track arc and no value arc. A full
// circle, ticks at north, east, south, and west, an "N" at the top, and a
// needle from the centre at the heading (0 at the top, clockwise). The
// needle turns through a CSS transform transition, and its rotation is
// kept cumulative so each change takes the short way round. An unavailable
// heading draws the rose with no needle and the placeholder value.

import { useState } from "react";
import { copy } from "../../../../copy/copy";
import { GaugeFrame, GAUGE_CENTER, GAUGE_RADIUS } from "./GaugeFrame";
import { headingText } from "./format";
import type { HeadingInstrumentProps } from "./types";
import * as styles from "./HeadingCompass.module.css";

export const TICK_LENGTH = 3;
export const NEEDLE_LENGTH = 15;

const C = GAUGE_CENTER;
const R = GAUGE_RADIUS;

// The rotation to turn to from `current` (any number of turns) so the
// needle points at `headingDeg` after moving at most 180 degrees.
export function shortestRotation(current: number, headingDeg: number): number {
  const delta = (((headingDeg - current) % 360) + 540) % 360 - 180;
  return current + delta;
}

export type HeadingCompassProps = { headingDeg: number | null };

export function HeadingCompass({ headingDeg }: HeadingCompassProps) {
  const known = headingDeg !== null && Number.isFinite(headingDeg);
  const [needle, setNeedle] = useState({ heading: known ? headingDeg : null, rotation: known ? headingDeg : 0 });
  const heading = known ? headingDeg : null;
  if (heading !== null && heading !== needle.heading) {
    setNeedle({ heading, rotation: shortestRotation(needle.rotation, heading) });
  }
  return (
    <GaugeFrame
      value={headingText(heading)}
      unit=""
      label={copy.map.flightDock.heading}
      track={false}
      testId="flight-gauge-heading"
    >
      <circle className={styles.rose} cx={C} cy={C} r={R} data-testid="flight-gauge-heading-rose" />
      <g className={styles.ticks}>
        <line x1={C} y1={C - R} x2={C} y2={C - R + TICK_LENGTH} />
        <line x1={C + R} y1={C} x2={C + R - TICK_LENGTH} y2={C} />
        <line x1={C} y1={C + R} x2={C} y2={C + R - TICK_LENGTH} />
        <line x1={C - R} y1={C} x2={C - R + TICK_LENGTH} y2={C} />
      </g>
      <text className={styles.north} x={C} y={C - R + TICK_LENGTH + 6} textAnchor="middle">
        N
      </text>
      {heading !== null ? (
        <g data-testid="flight-gauge-heading-needle">
          <line
            className={styles.needle}
            x1={C}
            y1={C}
            x2={C}
            y2={C - NEEDLE_LENGTH}
            style={{ transform: `rotate(${needle.rotation}deg)` }}
            data-testid="flight-gauge-heading-needle-line"
          />
          <circle className={styles.hub} cx={C} cy={C} r={2} />
        </g>
      ) : null}
    </GaugeFrame>
  );
}

// The slot adapter: the dock passes `degrees`; the compass derives the
// cardinal from the rounded degrees itself.
export function HeadingInstrument({ degrees }: HeadingInstrumentProps) {
  return <HeadingCompass headingDeg={degrees} />;
}
