// docs/site.md section 7.6. The strip overlay top-left of the map: four
// mono instruments (speed, heading, altitude, distance) plus the live
// indicator and liftoff timer.

import { useStore } from "../../../store/useStore";
import { mpsToMph, metresToFeet, headingToCardinal } from "../../../lib/units";
import { formatDistanceMetres } from "../../../map/userLocation";
import { copy } from "../../../copy/copy";
import { LiveIndicator } from "./LiveIndicator";
import { LiftoffTimer } from "./LiftoffTimer";
import * as styles from "./Map.module.css";

export type LiveStripProps = {
  distanceMetres: number | null;
  showLiveIndicator: boolean;
  showLiftoffTimer: boolean;
};

function fmtNumber(value: number | null, unit: string, digits = 0): { value: string; unit: string } {
  if (value === null || !Number.isFinite(value)) return { value: copy.live.unavailablePlaceholder, unit };
  return { value: value.toFixed(digits), unit };
}

export function LiveStrip({ distanceMetres, showLiveIndicator, showLiftoffTimer }: LiveStripProps) {
  const speedMps = useStore((s) => s.live?.speedMps ?? null);
  const headingDeg = useStore((s) => s.live?.headingDeg ?? null);
  const altitudeM = useStore((s) => s.live?.altitudeM ?? null);

  const speed = fmtNumber(speedMps !== null ? mpsToMph(speedMps) : null, "mph");
  const altitude = fmtNumber(altitudeM !== null ? metresToFeet(altitudeM) : null, "ft");
  const headingLabel =
    headingDeg === null
      ? { value: copy.live.unavailablePlaceholder, unit: "" }
      : { value: `${Math.round(headingDeg)}°`, unit: headingToCardinal(headingDeg) ?? "" };
  const distanceText =
    distanceMetres === null || !Number.isFinite(distanceMetres)
      ? copy.live.unavailablePlaceholder
      : formatDistanceMetres(distanceMetres);

  return (
    <div className={styles.liveStrip} data-testid="live-strip">
      <div className={styles.liveStripTags}>
        {showLiveIndicator ? <LiveIndicator /> : null}
        {showLiftoffTimer ? <LiftoffTimer /> : null}
      </div>
      <dl className={styles.liveStripInstruments}>
        <div className={styles.liveStripInst}>
          <dt>Speed</dt>
          <dd>
            <span className={styles.liveStripValue}>{speed.value}</span>
            <span className={styles.liveStripUnit}>{speed.unit}</span>
          </dd>
        </div>
        <div className={styles.liveStripInst}>
          <dt>Heading</dt>
          <dd>
            <span className={styles.liveStripValue}>{headingLabel.value}</span>
            <span className={styles.liveStripUnit}>{headingLabel.unit}</span>
          </dd>
        </div>
        <div className={styles.liveStripInst}>
          <dt>Altitude</dt>
          <dd>
            <span className={styles.liveStripValue}>{altitude.value}</span>
            <span className={styles.liveStripUnit}>{altitude.unit}</span>
          </dd>
        </div>
        <div className={styles.liveStripInst}>
          <dt>Distance</dt>
          <dd>
            <span className={styles.liveStripValue}>{distanceText}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
