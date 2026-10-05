// docs/site.md section 7.6. The flight gauge: three dials stacked above the
// sponsor tile, each on the glass recipe, all three up at once. It replaced
// the instrument dock across the bottom of the map, so nothing covers the
// map's bottom edge and neither bottom stack is lifted.
//
// The instruments are speed, altitude and heading, top to bottom. The
// airborne time and the distance are not among them: each has its own pill
// under the live pill (7.6). The tracker menu's gauge button hides all
// three at once.

import { useStore } from "../../../store/useStore";
import { headingToCardinal, metresToFeet, mpsToMph, type Cardinal } from "../../../lib/units";
import { instruments } from "./gauges/slots";
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

export function FlightGauge() {
  const readings = useFlightReadings();
  const Speed = instruments.speed;
  const Altitude = instruments.altitude;
  const Heading = instruments.heading;
  return (
    <div className={styles.flightGauge} data-testid="flight-gauge">
      <div className={styles.gaugeFace}>
        <Speed mph={readings.mph} />
      </div>
      <div className={styles.gaugeFace}>
        <Altitude feet={readings.feet} />
      </div>
      <div className={styles.gaugeFace}>
        <Heading degrees={readings.degrees} cardinal={readings.cardinal} />
      </div>
    </div>
  );
}
