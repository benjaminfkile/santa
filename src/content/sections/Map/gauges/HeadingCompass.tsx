// docs/site.md section 7.6. The gauge's heading dial: a compass face drawn
// in the gauge frame's children with no track arc and no value arc. The
// bezel circle, a long tick at each of north, east, south and west with a
// short one at the four points between, the letters N, E, S and W around
// the inside, and a two-ended needle that turns to the heading (0 at the
// top, clockwise): a filled accent head reaching the bezel and a dim tail
// opposite, both stopping short of the middle so the reading sits in the
// clear centre. The reading is the cardinal alone, "NW", not the degrees.
// The needle turns through a CSS transform transition, and its rotation is
// kept cumulative so each change takes the short way round. An unavailable
// heading draws the face with no needle and the placeholder.

import { useState } from "react";
import { copy } from "../../../../copy/copy";
import { GaugeFrame, GAUGE_CENTER, GAUGE_RADIUS } from "./GaugeFrame";
import { headingCardinalText } from "./format";
import type { HeadingInstrumentProps } from "./types";
import * as styles from "./HeadingCompass.module.css";

export const TICK_LENGTH = 3;
export const MINOR_TICK_LENGTH = 1.75;
// The needle's head runs from this radius out to the bezel, so the middle
// of the face stays clear for the reading.
export const NEEDLE_INNER = 12;
export const NEEDLE_HALF_WIDTH = 2.6;
// Where the N, E, S and W letters sit, measured from the centre.
export const LETTER_RADIUS = 14.5;

const C = GAUGE_CENTER;
const R = GAUGE_RADIUS;

// The rotation to turn to from `current` (any number of turns) so the
// needle points at `headingDeg` after moving at most 180 degrees.
export function shortestRotation(current: number, headingDeg: number): number {
  const delta = (((headingDeg - current) % 360) + 540) % 360 - 180;
  return current + delta;
}

// A tick from the bezel inward, at `deg` clockwise from the top.
function tick(deg: number, length: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return {
    x1: C + R * cos,
    y1: C + R * sin,
    x2: C + (R - length) * cos,
    y2: C + (R - length) * sin,
  };
}

const MAJOR = [0, 90, 180, 270];
const MINOR = [45, 135, 225, 315];

// The needle, drawn pointing north; the group rotates it to the heading.
const HEAD = `M${C} ${C - R + 1} L${C + NEEDLE_HALF_WIDTH} ${C - NEEDLE_INNER} L${C - NEEDLE_HALF_WIDTH} ${C - NEEDLE_INNER} Z`;
const TAIL = `M${C} ${C + R - 1} L${C + NEEDLE_HALF_WIDTH} ${C + NEEDLE_INNER} L${C - NEEDLE_HALF_WIDTH} ${C + NEEDLE_INNER} Z`;

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
      value={headingCardinalText(heading)}
      valueSize={12}
      unit=""
      label={copy.map.flightDock.heading}
      track={false}
      testId="flight-gauge-heading"
    >
      <circle className={styles.rose} cx={C} cy={C} r={R} data-testid="flight-gauge-heading-rose" />
      <g className={styles.ticks} data-testid="flight-gauge-heading-ticks">
        {MAJOR.map((deg) => {
          const t = tick(deg, TICK_LENGTH);
          return <line key={`major-${deg}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />;
        })}
      </g>
      <g className={styles.minorTicks}>
        {MINOR.map((deg) => {
          const t = tick(deg, MINOR_TICK_LENGTH);
          return <line key={`minor-${deg}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />;
        })}
      </g>
      <text className={styles.north} x={C} y={C - LETTER_RADIUS + 2} textAnchor="middle">
        N
      </text>
      <text className={styles.point} x={C + LETTER_RADIUS} y={C + 1.6} textAnchor="middle">
        E
      </text>
      <text className={styles.point} x={C} y={C + LETTER_RADIUS + 1.6} textAnchor="middle">
        S
      </text>
      <text className={styles.point} x={C - LETTER_RADIUS} y={C + 1.6} textAnchor="middle">
        W
      </text>
      {heading !== null ? (
        <g
          className={styles.needle}
          style={{ transform: `rotate(${needle.rotation}deg)` }}
          data-testid="flight-gauge-heading-needle"
        >
          <path className={styles.needleHead} d={HEAD} data-testid="flight-gauge-heading-needle-line" />
          <path className={styles.needleTail} d={TAIL} />
        </g>
      ) : null}
    </GaugeFrame>
  );
}

// The slot adapter: the gauge passes `degrees`; the compass derives the
// cardinal from the rounded degrees itself.
export function HeadingInstrument({ degrees }: HeadingInstrumentProps) {
  return <HeadingCompass headingDeg={degrees} />;
}
