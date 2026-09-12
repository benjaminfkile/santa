// docs/site.md section 7.6. The instrument line: one pill with speed,
// heading, and altitude in mono, under the live and airborne pills.

import { useStore } from "../../../store/useStore";
import { mpsToMph, metresToFeet, headingToCardinal } from "../../../lib/units";
import { copy } from "../../../copy/copy";
import { SpeedGlyph } from "./glyphs";
import * as styles from "./Map.module.css";

function fmtNumber(value: number | null, unit: string, digits = 0): { value: string; unit: string } {
  if (value === null || !Number.isFinite(value)) return { value: copy.live.unavailablePlaceholder, unit };
  return { value: value.toFixed(digits), unit };
}

export function LiveStrip() {
  const speedMps = useStore((s) => s.live?.speedMps ?? null);
  const headingDeg = useStore((s) => s.live?.headingDeg ?? null);
  const altitudeM = useStore((s) => s.live?.altitudeM ?? null);

  const speed = fmtNumber(speedMps !== null ? mpsToMph(speedMps) : null, "mph");
  const altitude = fmtNumber(altitudeM !== null ? metresToFeet(altitudeM) : null, "ft");
  const heading =
    headingDeg === null
      ? { value: copy.live.unavailablePlaceholder, unit: "" }
      : { value: `${Math.round(headingDeg)}°`, unit: headingToCardinal(headingDeg) ?? "" };

  return (
    <div className={styles.liveStrip} data-testid="live-strip">
      <SpeedGlyph />
      <span className={styles.liveStripInst}>
        <span className={styles.liveStripValue}>{speed.value}</span>
        <span className={styles.liveStripUnit}>{speed.unit}</span>
      </span>
      <span className={styles.liveStripInst}>
        <span className={styles.liveStripValue}>{heading.value}</span>
        <span className={styles.liveStripUnit}>{heading.unit}</span>
      </span>
      <span className={styles.liveStripInst}>
        <span className={styles.liveStripValue}>{altitude.value}</span>
        <span className={styles.liveStripUnit}>{altitude.unit}</span>
      </span>
    </div>
  );
}
