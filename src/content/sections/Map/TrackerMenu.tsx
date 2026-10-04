// docs/site.md section 7.6. Tracker menu: the legacy tracker's card in the
// top-right corner. Map styles as the legacy round thumbnails (three by two)
// with a nickname and an accent underline on the active one, then Terrain, Road, and Snow, then
// the data row (a glyph and a value per item), then the footer row: the
// account button (sign in or sign out) alone on the left, and flight data,
// location, flight history, time labels, fit, landmarks, and close as
// square buttons on the right. Landmarks shows while the site has
// landmarks and the section's `controls.landmarks` is not false.

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import { useStore } from "../../../store/useStore";
import { mpsToMph, metresToFeet, headingToCardinal } from "../../../lib/units";
import { formatEventTime } from "../../../lib/time";
import { formatDistanceMetres } from "../../../map/userLocation";
import { copy } from "../../../copy/copy";
import type { MapTheme } from "../../../map/themes";
import {
  AccuracyGlyph,
  AltitudeGlyph,
  ClockGlyph,
  CloseGlyph,
  CompassGlyph,
  LandmarkGlyph,
  GaugeGlyph,
  HistoryGlyph,
  InboxGlyph,
  LocationGlyph,
  PersonPinGlyph,
  RoadGlyph,
  SignInGlyph,
  SignOutGlyph,
  SnowGlyph,
  SpeedGlyph,
  TakeoffGlyph,
  TerrainGlyph,
  TimesGlyph,
} from "./glyphs";
import * as styles from "./TrackerMenu.module.css";

type Toggles = {
  themePicker: boolean;
  terrain: boolean;
  snow: boolean;
  flightHistory: boolean;
  timeLabels: boolean;
  location: boolean;
  dataRow: boolean;
  landmarks?: boolean;
};

export type TrackerMenuProps = {
  open: boolean;
  onClose: () => void;
  controls: Toggles;
  themes: MapTheme[];
  themeKey: string;
  onThemeChange: (key: string) => void;
  mapType: "terrain" | "roadmap";
  onMapTypeChange: (t: "terrain" | "roadmap") => void;
  snow: boolean;
  onSnowChange: (v: boolean) => void;
  flightHistoryAvailable: boolean;
  flightHistory: boolean;
  onFlightHistoryChange: (v: boolean) => void;
  timeLabels: boolean;
  onTimeLabelsChange: (v: boolean) => void;
  landmarksAvailable?: boolean;
  landmarks?: boolean;
  onLandmarksChange?: (v: boolean) => void;
  flightDockAvailable: boolean;
  flightDock: boolean;
  onFlightDockChange: (v: boolean) => void;
  onOpenLocation: () => void;
  // Whether the visitor's location is on (the dot on the map); the location
  // button is pressed while it is.
  locationEnabled: boolean;
  distanceMetres: number | null;
};

function fmt(value: number | null | undefined, unit: string, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return copy.live.unavailablePlaceholder;
  return `${value.toFixed(digits)} ${unit}`;
}

export function TrackerMenu(props: TrackerMenuProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const speedMps = useStore((s) => s.live?.speedMps ?? null);
  const headingDeg = useStore((s) => s.live?.headingDeg ?? null);
  const altitudeM = useStore((s) => s.live?.altitudeM ?? null);
  const accuracyM = useStore((s) => s.live?.accuracyM ?? null);
  const wentLiveAt = useStore((s) => s.snapshot?.event?.wentLiveAt ?? null);
  const recordedAt = useStore((s) => s.live?.recordedAt ?? null);
  const receivedAt = useStore((s) => s.live?.receivedAt ?? null);
  const { state: authState, signIn, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!props.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  if (!props.open) return null;

  const speedMph = speedMps !== null ? mpsToMph(speedMps) : null;
  const altitudeFt = altitudeM !== null ? metresToFeet(altitudeM) : null;
  const accuracyFt = accuracyM !== null ? metresToFeet(accuracyM) : null;
  const cardinal = headingDeg !== null ? headingToCardinal(headingDeg) : null;
  const showFlightHistory = props.controls.flightHistory && props.flightHistoryAvailable;
  const showLandmarks = props.controls.landmarks !== false && props.landmarksAvailable === true;

  return (
    <div
      ref={dialogRef}
      className={styles.trackerMenu}
      role="dialog"
      aria-label="Tracker menu"
      data-testid="tracker-menu"
    >
      <div className={styles.panel}>
        {props.controls.themePicker ? (
          <div className={styles.themes} role="radiogroup" aria-label="Map style">
            {props.themes.map((t) => {
              const selected = props.themeKey === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => props.onThemeChange(t.key)}
                  className={selected ? `${styles.theme} ${styles.themeSelected} ${styles.onMark}` : styles.theme}
                  data-testid={`tracker-menu-theme-${t.key}`}
                >
                  <img className={styles.themeThumb} src={`/tracker-themes/${t.key}.png`} alt="" width={54} height={54} />
                  <span className={styles.themeLabel}>{t.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {props.controls.terrain || props.controls.snow ? (
          <div className={styles.row}>
            {props.controls.terrain ? (
              <>
                <button
                  type="button"
                  role="radio"
                  aria-checked={props.mapType === "terrain"}
                  onClick={() => props.onMapTypeChange("terrain")}
                  className={props.mapType === "terrain" ? `${styles.pill} ${styles.pillSelected}` : styles.pill}
                >
                  <TerrainGlyph />
                  Terrain
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={props.mapType === "roadmap"}
                  onClick={() => props.onMapTypeChange("roadmap")}
                  className={props.mapType === "roadmap" ? `${styles.pill} ${styles.pillSelected}` : styles.pill}
                >
                  <RoadGlyph />
                  Road
                </button>
              </>
            ) : null}
            {props.controls.snow ? (
              <button
                type="button"
                className={styles.toggle}
                aria-pressed={props.snow}
                onClick={() => props.onSnowChange(!props.snow)}
                data-testid="tracker-menu-snow"
              >
                <SnowGlyph />
                Snow
              </button>
            ) : null}
          </div>
        ) : null}

        {props.controls.dataRow ? (
          <dl className={styles.dataRow} data-testid="tracker-menu-data-row">
            <div>
              <dt><SpeedGlyph /><span>Speed</span></dt>
              <dd data-testid="data-row-speed">{fmt(speedMph, "mph", 0)}</dd>
            </div>
            <div>
              <dt><CompassGlyph /><span>Heading</span></dt>
              <dd>
                {headingDeg === null
                  ? copy.live.unavailablePlaceholder
                  : `${Math.round(headingDeg)}° ${cardinal ?? ""}`.trim()}
              </dd>
            </div>
            <div>
              <dt><AltitudeGlyph /><span>Altitude</span></dt>
              <dd>{fmt(altitudeFt, "ft", 0)}</dd>
            </div>
            <div>
              <dt><AccuracyGlyph /><span>Accuracy</span></dt>
              <dd>{fmt(accuracyFt, "ft", 0)}</dd>
            </div>
            <div>
              <dt><PersonPinGlyph /><span>Distance</span></dt>
              <dd data-testid="data-row-distance">
                {props.distanceMetres === null
                  ? copy.live.unavailablePlaceholder
                  : formatDistanceMetres(props.distanceMetres)}
              </dd>
            </div>
            <div>
              <dt><TakeoffGlyph /><span>Liftoff</span></dt>
              <dd data-testid="data-row-liftoff">
                {formatEventTime(wentLiveAt) || copy.live.unavailablePlaceholder}
              </dd>
            </div>
            <div>
              <dt><ClockGlyph /><span>Recorded</span></dt>
              <dd data-testid="data-row-recorded">
                {formatEventTime(recordedAt) || copy.live.unavailablePlaceholder}
              </dd>
            </div>
            <div>
              <dt><InboxGlyph /><span>Received</span></dt>
              <dd data-testid="data-row-received">
                {formatEventTime(receivedAt) || copy.live.unavailablePlaceholder}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className={styles.footer}>
          <div className={styles.footerStart} data-testid="tracker-menu-account">
            {authState.status === "signedOut" ? (
              <div className={styles.footerItem}>
                <span className={styles.footerLabel} aria-hidden>{copy.signIn.button}</span>
                <button
                  type="button"
                  className={styles.footerBtn}
                  aria-label={copy.signIn.button}
                  onClick={() => {
                    props.onClose();
                    void signIn(location.pathname + location.search);
                  }}
                  data-testid="tracker-menu-sign-in"
                >
                  <SignInGlyph size={22} />
                </button>
              </div>
            ) : null}
            {authState.status === "signedIn" ? (
              <div className={styles.footerItem}>
                <span className={styles.footerLabel} aria-hidden>{copy.signIn.signOut}</span>
                <button
                  type="button"
                  className={styles.footerBtn}
                  aria-label={copy.signIn.signOut}
                  onClick={() => void signOut()}
                  data-testid="tracker-menu-sign-out"
                >
                  <SignOutGlyph size={22} />
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.footerEnd} data-testid="tracker-menu-toggles">
            {props.flightDockAvailable ? (
              <div className={styles.footerItem}>
                <span className={styles.footerLabel} aria-hidden>{copy.tracker.data}</span>
                <button
                  type="button"
                  className={styles.footerBtn}
                  aria-pressed={props.flightDock}
                  aria-label={copy.tracker.data}
                  onClick={() => props.onFlightDockChange(!props.flightDock)}
                  data-testid="tracker-menu-flight-dock"
                >
                  <GaugeGlyph size={22} />
                </button>
              </div>
            ) : null}
            {props.controls.location ? (
              <div className={styles.footerItem}>
                <span className={styles.footerLabel} aria-hidden>{copy.tracker.location}</span>
                <button
                  type="button"
                  className={styles.footerBtn}
                  onClick={props.onOpenLocation}
                  aria-label="Your location"
                  aria-pressed={props.locationEnabled}
                  data-testid="tracker-menu-location"
                >
                  <LocationGlyph size={22} />
                </button>
              </div>
            ) : null}
            {showFlightHistory ? (
              <div className={styles.footerItem}>
                <span className={styles.footerLabel} aria-hidden>{copy.tracker.history}</span>
                <button
                  type="button"
                  className={styles.footerBtn}
                  aria-pressed={props.flightHistory}
                  aria-label={copy.tracker.history}
                  onClick={() => props.onFlightHistoryChange(!props.flightHistory)}
                  data-testid="tracker-menu-flight-history"
                >
                  <HistoryGlyph size={22} />
                </button>
              </div>
            ) : null}
            {showFlightHistory && props.flightHistory ? (
              <div className={styles.footerItem}>
                <span className={styles.footerLabel} aria-hidden>{copy.tracker.times}</span>
                <button
                  type="button"
                  className={styles.footerBtn}
                  aria-pressed={props.timeLabels}
                  aria-label="Time labels"
                  onClick={() => props.onTimeLabelsChange(!props.timeLabels)}
                  data-testid="tracker-menu-time-labels"
                >
                  <TimesGlyph size={22} />
                </button>
              </div>
            ) : null}
            {showLandmarks ? (
              <div className={styles.footerItem}>
                <span className={styles.footerLabel} aria-hidden>{copy.tracker.landmarks}</span>
                <button
                  type="button"
                  className={styles.footerBtn}
                  aria-pressed={props.landmarks === true}
                  aria-label={copy.tracker.landmarks}
                  onClick={() => props.onLandmarksChange?.(props.landmarks !== true)}
                  data-testid="tracker-menu-landmarks"
                >
                  <LandmarkGlyph size={22} />
                </button>
              </div>
            ) : null}
            <div className={styles.footerItem}>
              <span className={styles.footerLabel} aria-hidden>{copy.tracker.close}</span>
              <button type="button" className={styles.close} onClick={props.onClose} aria-label="Close menu">
                <CloseGlyph size={22} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
