// docs/site.md section 7.6. The three instruments the flight gauge cycles,
// in order speed, altitude, heading. Each entry meets its contract in
// types.ts. Speed and altitude are dials and heading is a compass; the
// airborne time is a pill under the live pill, not a dial.

import { SpeedInstrument } from "./SpeedDial";
import { AltitudeInstrument } from "./AltitudeDial";
import { HeadingInstrument } from "./HeadingCompass";
import type { InstrumentSlots } from "./types";

export const instruments: InstrumentSlots = {
  speed: SpeedInstrument,
  altitude: AltitudeInstrument,
  heading: HeadingInstrument,
};
