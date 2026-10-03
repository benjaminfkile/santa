// docs/site.md section 7.6. The flight data dock: one glass surface across
// the bottom of the map holding a handle row that collapses it, the
// instrument row (speed, altitude, heading, airborne, each a slot from
// gauges/), and a foot line with the distance to Santa and the fix
// accuracy. Collapsed, the dock gives way to one handle pill in the
// bottom-left stack with the speed and the airborne time. The dock reads
// the store and passes plain values to the instruments.

import { useEffect, useRef } from "react";
import { useStore } from "../../../store/useStore";
import { selectTimeReady } from "../../../store/liveState";
import { headingToCardinal, metresToFeet, mpsToMph, type Cardinal } from "../../../lib/units";
import { useNow } from "../../../lib/useNow";
import { formatDistanceMetres } from "../../../map/userLocation";
import { copy } from "../../../copy/copy";
import { instruments } from "./gauges/slots";
import { airborneText, feetText, speedText } from "./gauges/format";
import { ChevronGlyph, GaugeGlyph } from "./glyphs";
import * as styles from "./FlightDock.module.css";
import * as mapStyles from "./Map.module.css";

type Readings = {
  mph: number | null;
  feet: number | null;
  degrees: number | null;
  cardinal: Cardinal | null;
  accuracyFeet: number | null;
  elapsedMs: number | null;
};

function finiteOrNull(n: number | null | undefined): number | null {
  return n === null || n === undefined || !Number.isFinite(n) ? null : n;
}

function useFlightReadings(): Readings {
  const speedMps = useStore((s) => finiteOrNull(s.live?.speedMps));
  const altitudeM = useStore((s) => finiteOrNull(s.live?.altitudeM));
  const headingDeg = useStore((s) => finiteOrNull(s.live?.headingDeg));
  const accuracyM = useStore((s) => finiteOrNull(s.live?.accuracyM));
  const wentLiveAt = useStore((s) => s.snapshot?.event?.wentLiveAt ?? null);
  const timeReady = useStore(selectTimeReady);
  const now = useNow(1000);
  const started = timeReady && wentLiveAt !== null && wentLiveAt !== "" ? Date.parse(wentLiveAt) : NaN;
  return {
    mph: speedMps === null ? null : mpsToMph(speedMps),
    feet: altitudeM === null ? null : metresToFeet(altitudeM),
    degrees: headingDeg,
    cardinal: headingDeg === null ? null : headingToCardinal(headingDeg),
    accuracyFeet: accuracyM === null ? null : metresToFeet(accuracyM),
    elapsedMs: Number.isNaN(started) ? null : now - started,
  };
}

type DockContent = {
  // overlays.flightDock: speed, altitude, heading, and accuracy.
  showInstruments: boolean;
  // overlays.liftoffTimer: the airborne slot.
  showAirborne: boolean;
};

export type FlightDockProps = DockContent & {
  // The distance to Santa, or null when the distance entry is off or the
  // visitor's location has no fix.
  distanceMetres: number | null;
  onCollapse: () => void;
  // The dock's rendered height in px, on mount and on every resize.
  onHeightChange: (px: number) => void;
};

export function FlightDock({ showInstruments, showAirborne, distanceMetres, onCollapse, onHeightChange }: FlightDockProps) {
  const ref = useRef<HTMLElement | null>(null);
  const r = useFlightReadings();

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const measure = () => onHeightChange(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange]);

  const { speed: Speed, altitude: Altitude, heading: Heading, airborne: Airborne } = instruments;
  const distance = distanceMetres === null ? "" : formatDistanceMetres(distanceMetres);
  const accuracy = showInstruments && r.accuracyFeet !== null ? `${feetText(r.accuracyFeet)} ft` : "";

  return (
    <section ref={ref} className={styles.dock} aria-label={copy.map.flightDock.title} data-testid="flight-dock">
      <button
        type="button"
        className={styles.handle}
        aria-expanded={true}
        onClick={onCollapse}
        data-testid="flight-dock-toggle"
      >
        <span>{copy.map.flightDock.title}</span>
        <ChevronGlyph size={16} />
      </button>
      <div className={styles.instruments}>
        {showInstruments ? <Speed mph={r.mph} /> : null}
        {showInstruments ? <Altitude feet={r.feet} /> : null}
        {showInstruments ? <Heading degrees={r.degrees} cardinal={r.cardinal} /> : null}
        {showAirborne ? <Airborne elapsedMs={r.elapsedMs} /> : null}
      </div>
      {distance !== "" || accuracy !== "" ? (
        <p className={styles.foot} data-testid="flight-dock-foot">
          {distance !== "" ? (
            <span data-testid="flight-dock-distance">
              <span className={styles.footLabel}>{copy.map.flightDock.distance}</span> {distance}
            </span>
          ) : null}
          {accuracy !== "" ? (
            <span data-testid="flight-dock-accuracy">
              <span className={styles.footLabel}>{copy.map.flightDock.accuracy}</span> {accuracy}
            </span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

export type FlightDockHandleProps = DockContent & { onExpand: () => void };

// The collapsed dock: a 34 px pill with the gauge glyph, the speed, a
// middle dot, the airborne time, and a chevron.
export function FlightDockHandle({ showInstruments, showAirborne, onExpand }: FlightDockHandleProps) {
  const r = useFlightReadings();
  const speed = showInstruments ? `${speedText(r.mph)} mph` : "";
  const airborne = showAirborne ? airborneText(r.elapsedMs) : "";
  return (
    <button
      type="button"
      className={styles.handlePill}
      aria-expanded={false}
      onClick={onExpand}
      data-testid="flight-dock-handle"
    >
      <GaugeGlyph />
      <span className={mapStyles.visuallyHidden}>{copy.map.flightDock.title}</span>
      {speed !== "" ? <span data-testid="flight-dock-handle-speed">{speed}</span> : null}
      {speed !== "" && airborne !== "" ? <span className={styles.dot} aria-hidden>·</span> : null}
      {airborne !== "" ? <span data-testid="flight-dock-handle-airborne">{airborne}</span> : null}
      <ChevronGlyph size={16} className={styles.chevronUp} />
    </button>
  );
}
