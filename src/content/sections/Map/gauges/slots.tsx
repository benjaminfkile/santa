// docs/site.md section 7.6. The four instruments the flight data dock
// renders, in order speed, altitude, heading, airborne. Each entry meets
// its contract in types.ts; every slot is a text instrument.

import { copy } from "../../../../copy/copy";
import { TextInstrument } from "./TextInstrument";
import { airborneText, feetText, headingText, speedText } from "./format";
import type {
  AirborneInstrumentProps,
  AltitudeInstrumentProps,
  HeadingInstrumentProps,
  InstrumentSlots,
  SpeedInstrumentProps,
} from "./types";

const labels = copy.map.flightDock;

function SpeedInstrument({ mph }: SpeedInstrumentProps) {
  return <TextInstrument value={speedText(mph)} unit="mph" label={labels.speed} testId="flight-dock-speed" />;
}

function AltitudeInstrument({ feet }: AltitudeInstrumentProps) {
  return <TextInstrument value={feetText(feet)} unit="ft" label={labels.altitude} testId="flight-dock-altitude" />;
}

function HeadingInstrument({ degrees, cardinal }: HeadingInstrumentProps) {
  return (
    <TextInstrument
      value={headingText(degrees)}
      unit={degrees === null ? "" : (cardinal ?? "")}
      label={labels.heading}
      testId="flight-dock-heading"
    />
  );
}

function AirborneInstrument({ elapsedMs }: AirborneInstrumentProps) {
  return <TextInstrument value={airborneText(elapsedMs)} unit="" label={labels.airborne} testId="flight-dock-airborne" />;
}

export const instruments: InstrumentSlots = {
  speed: SpeedInstrument,
  altitude: AltitudeInstrument,
  heading: HeadingInstrument,
  airborne: AirborneInstrument,
};
