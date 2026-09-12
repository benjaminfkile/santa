// docs/site.md section 7.6. The strip overlay top-left of the map: four
// mono instruments (speed, heading, altitude, distance) plus the live
// indicator and liftoff timer.

import { useStore } from "../../../store/useStore";
import { mpsToMph, metresToFeet, headingToCardinal } from "../../../lib/units";
import { formatDistanceMetres } from "../../../map/userLocation";
import { copy } from "../../../copy/copy";
import { LiveIndicator } from "./LiveIndicator";
import { LiftoffTimer } from "./LiftoffTimer";

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
    <div className="live-strip" data-testid="live-strip">
      <div className="live-strip__tags">
        {showLiveIndicator ? <LiveIndicator /> : null}
        {showLiftoffTimer ? <LiftoffTimer /> : null}
      </div>
      <dl className="live-strip__instruments">
        <div className="live-strip__inst">
          <dt>Speed</dt>
          <dd>
            <span className="live-strip__value">{speed.value}</span>
            <span className="live-strip__unit">{speed.unit}</span>
          </dd>
        </div>
        <div className="live-strip__inst">
          <dt>Heading</dt>
          <dd>
            <span className="live-strip__value">{headingLabel.value}</span>
            <span className="live-strip__unit">{headingLabel.unit}</span>
          </dd>
        </div>
        <div className="live-strip__inst">
          <dt>Altitude</dt>
          <dd>
            <span className="live-strip__value">{altitude.value}</span>
            <span className="live-strip__unit">{altitude.unit}</span>
          </dd>
        </div>
        <div className="live-strip__inst">
          <dt>Distance</dt>
          <dd>
            <span className="live-strip__value">{distanceText}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
