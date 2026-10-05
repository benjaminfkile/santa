// docs/site.md section 7.6. The gauge's altitude dial: feet through
// formatCount on a 0 to 10,000 ft dial. A higher altitude fills
// the arc and keeps its exact number; a negative altitude shows its number
// over an empty arc; an unavailable altitude shows the placeholder and no
// value arc.

import { copy } from "../../../../copy/copy";
import { GaugeFrame } from "./GaugeFrame";
import { feetText } from "./format";
import type { AltitudeInstrumentProps } from "./types";

export const ALTITUDE_SCALE_FT = 10000;

export type AltitudeDialProps = { altitudeFt: number | null };

export function AltitudeDial({ altitudeFt }: AltitudeDialProps) {
  const known = altitudeFt !== null && Number.isFinite(altitudeFt);
  return (
    <GaugeFrame
      value={feetText(altitudeFt)}
      unit="ft"
      label={copy.map.flightDock.altitude}
      fraction={known ? altitudeFt / ALTITUDE_SCALE_FT : null}
      testId="flight-gauge-altitude"
    />
  );
}

// The slot adapter: the dock passes `feet`.
export function AltitudeInstrument({ feet }: AltitudeInstrumentProps) {
  return <AltitudeDial altitudeFt={feet} />;
}
