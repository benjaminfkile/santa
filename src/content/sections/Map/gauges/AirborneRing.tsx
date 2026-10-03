// docs/site.md section 7.6. The dock's airborne slot: the time since
// liftoff from formatElapsed on a three hour ring. A longer flight keeps
// the arc full while the time keeps counting; an unavailable time shows
// the placeholder and no value arc.

import { formatElapsed } from "../../../../lib/time";
import { copy } from "../../../../copy/copy";
import { GaugeFrame } from "./GaugeFrame";
import type { AirborneInstrumentProps } from "./types";

export const AIRBORNE_SCALE_MS = 3 * 60 * 60 * 1000;

export type AirborneRingProps = { elapsedMs: number | null };

export function AirborneRing({ elapsedMs }: AirborneRingProps) {
  const known = elapsedMs !== null && Number.isFinite(elapsedMs);
  return (
    <GaugeFrame
      value={known ? formatElapsed(elapsedMs) : copy.live.unavailablePlaceholder}
      unit=""
      label={copy.map.flightDock.airborne}
      fraction={known ? elapsedMs / AIRBORNE_SCALE_MS : null}
      testId="flight-dock-airborne"
    />
  );
}

// The slot adapter: the dock passes `elapsedMs`.
export function AirborneInstrument({ elapsedMs }: AirborneInstrumentProps) {
  return <AirborneRing elapsedMs={elapsedMs} />;
}
