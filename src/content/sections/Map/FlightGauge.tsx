// docs/site.md section 7.6. The flight gauge: one round dial on the glass
// recipe above the sponsor tile, showing one instrument at a time, with an
// arrow tight against each side to step through them. It replaced the
// instrument dock across the bottom of the map, so nothing covers the
// bottom of the map any more and neither bottom stack is lifted.
//
// The instruments are speed, altitude and heading, in that order. Distance
// and the airborne time are not among them: each has its own pill under the
// live pill (7.6), because they are readings a visitor wants up the whole
// time rather than one stop of a cycle. The tracker menu's gauge button
// hides the whole thing, and the chosen instrument is kept for the page
// load in trackerToggles like the tracker's other choices.

import { useStore } from "../../../store/useStore";
import { headingToCardinal, metresToFeet, mpsToMph, type Cardinal } from "../../../lib/units";
import { copy } from "../../../copy/copy";
import { instruments } from "./gauges/slots";
import { ChevronGlyph } from "./glyphs";
import { readGaugeSlot, writeGaugeSlot, type GaugeSlotKey } from "./trackerToggles";
import { useState } from "react";
import * as styles from "./FlightGauge.module.css";

type Readings = {
  mph: number | null;
  feet: number | null;
  degrees: number | null;
  cardinal: Cardinal | null;
};

function finiteOrNull(n: number | null | undefined): number | null {
  return n === null || n === undefined || !Number.isFinite(n) ? null : n;
}

export function useFlightReadings(): Readings {
  const speedMps = useStore((s) => finiteOrNull(s.live?.speedMps));
  const altitudeM = useStore((s) => finiteOrNull(s.live?.altitudeM));
  const headingDeg = useStore((s) => finiteOrNull(s.live?.headingDeg));
  return {
    mph: speedMps === null ? null : mpsToMph(speedMps),
    feet: altitudeM === null ? null : metresToFeet(altitudeM),
    degrees: headingDeg,
    cardinal: headingDeg === null ? null : headingToCardinal(headingDeg),
  };
}

export type FlightGaugeProps = {
  // overlays.flightDock: speed, altitude and heading.
  showInstruments: boolean;
};

// Which instruments the flags leave on, in the dial's order.
export function gaugeSlots(showInstruments: boolean): GaugeSlotKey[] {
  return showInstruments ? ["speed", "altitude", "heading"] : [];
}

export function FlightGauge({ showInstruments }: FlightGaugeProps) {
  const readings = useFlightReadings();
  const slots = gaugeSlots(showInstruments);
  // The remembered choice, or the first instrument when a flag has since
  // turned the remembered one off.
  const [chosen, setChosen] = useState<GaugeSlotKey>(() => readGaugeSlot("speed"));

  if (slots.length === 0) return null;
  const current = slots.includes(chosen) ? chosen : slots[0];
  const index = slots.indexOf(current);

  const step = (delta: number) => {
    const next = slots[(index + delta + slots.length) % slots.length];
    writeGaugeSlot(next);
    setChosen(next);
  };

  const Speed = instruments.speed;
  const Altitude = instruments.altitude;
  const Heading = instruments.heading;

  return (
    <div className={styles.flightGauge} data-testid="flight-gauge" data-slot={current}>
      {slots.length > 1 ? (
        <button
          type="button"
          className={styles.gaugeArrow}
          aria-label={copy.map.flightGauge.previous}
          onClick={() => step(-1)}
          data-testid="flight-gauge-prev"
        >
          <ChevronGlyph size={18} />
        </button>
      ) : null}
      <div className={styles.gaugeFace}>
        {current === "speed" ? <Speed mph={readings.mph} /> : null}
        {current === "altitude" ? <Altitude feet={readings.feet} /> : null}
        {current === "heading" ? <Heading degrees={readings.degrees} cardinal={readings.cardinal} /> : null}
      </div>
      {slots.length > 1 ? (
        <button
          type="button"
          className={`${styles.gaugeArrow} ${styles.gaugeArrowNext}`}
          aria-label={copy.map.flightGauge.next}
          onClick={() => step(1)}
          data-testid="flight-gauge-next"
        >
          <ChevronGlyph size={18} />
        </button>
      ) : null}
    </div>
  );
}
