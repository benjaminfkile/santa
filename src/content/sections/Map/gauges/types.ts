// docs/site.md section 7.6. The flight gauge's slot contract. Each
// instrument is a component that takes its own typed value props and
// nothing about the store: the gauge reads the store, converts the units,
// and passes the values down, so any one slot can be replaced without
// touching the gauge. A null value means the reading is unavailable.

import type { ComponentType } from "react";
import type { Cardinal } from "../../../../lib/units";

export type SpeedInstrumentProps = { mph: number | null };

export type AltitudeInstrumentProps = { feet: number | null };

export type HeadingInstrumentProps = { degrees: number | null; cardinal: Cardinal | null };

export type InstrumentSlots = {
  speed: ComponentType<SpeedInstrumentProps>;
  altitude: ComponentType<AltitudeInstrumentProps>;
  heading: ComponentType<HeadingInstrumentProps>;
};
