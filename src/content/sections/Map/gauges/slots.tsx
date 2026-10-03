// docs/site.md section 7.6. The four instruments the flight data dock
// renders, in order speed, altitude, heading, airborne. Each entry meets
// its contract in types.ts. Speed and altitude are dials, heading is a
// compass, and airborne is a ring.

import { SpeedInstrument } from "./SpeedDial";
import { AltitudeInstrument } from "./AltitudeDial";
import { HeadingInstrument } from "./HeadingCompass";
import { AirborneInstrument } from "./AirborneRing";
import type { InstrumentSlots } from "./types";

export const instruments: InstrumentSlots = {
  speed: SpeedInstrument,
  altitude: AltitudeInstrument,
  heading: HeadingInstrument,
  airborne: AirborneInstrument,
};
