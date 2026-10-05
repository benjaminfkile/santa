// docs/site.md section 7.6. The gauge's speed dial: whole mph on a 0 to
// 120 mph dial. A faster speed fills the arc and keeps its exact number;
// an unavailable speed shows the placeholder and no value arc.

import { copy } from "../../../../copy/copy";
import { GaugeFrame } from "./GaugeFrame";
import { speedText } from "./format";
import type { SpeedInstrumentProps } from "./types";

export const SPEED_SCALE_MPH = 120;

export type SpeedDialProps = { speedMph: number | null };

export function SpeedDial({ speedMph }: SpeedDialProps) {
  const known = speedMph !== null && Number.isFinite(speedMph);
  return (
    <GaugeFrame
      value={speedText(speedMph)}
      unit="mph"
      label={copy.map.flightDock.speed}
      fraction={known ? speedMph / SPEED_SCALE_MPH : null}
      testId="flight-gauge-speed"
    />
  );
}

// The slot adapter: the dock passes `mph`.
export function SpeedInstrument({ mph }: SpeedInstrumentProps) {
  return <SpeedDial speedMph={mph} />;
}
