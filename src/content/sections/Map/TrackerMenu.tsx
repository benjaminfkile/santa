// docs/site.md section 7.6. Tracker menu: the legacy tracker's card in the
// top-right corner. Map styles as the legacy round thumbnails (three by two)
// with a nickname and an accent underline on the active one, then Terrain, Road, and Snow, then
// the data row (a glyph and a value per item), then the footer row: the
// account button (sign in or sign out) alone on the left, and flight data,
// location, flight history, time labels, fit, viewpoints, and close as
// square buttons on the right. Viewpoints shows while the site has
// viewpoints and the section's `controls.landmarks` is not false.
// Each style's thumbnail is the `480` variant of its `thumbnailMediaId`
// from the snapshot's media; a style without one, or whose media does not
// resolve, shows a swatch of its chrome (the background ringed in the
// accent). A pick waits for `onThemeChange` to settle, the button marked
// busy meanwhile.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import { useStore } from "../../../store/useStore";
import { mpsToMph, metresToFeet, headingToCardinal } from "../../../lib/units";
import { formatEventTime } from "../../../lib/time";
import { formatCountWithUnit } from "../../../lib/number";
import { formatDistanceMetres } from "../../../map/userLocation";
import { copy } from "../../../copy/copy";
import type { MapTheme } from "../../../map/themes";
import {
  AccuracyGlyph,
  AltitudeGlyph,
  CloseGlyph,
  CompassGlyph,
  ViewpointGlyph,
  GaugeGlyph,
  RouteGlyph,
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
  onThemeChange: (key: string) => void | Promise<void>;
  mapType: "terrain" | "roadmap";
  onMapTypeChange: (t: "terrain" | "roadmap") => void;
  snow: boolean;
  onSnowChange: (v: boolean) => void;
  flightHistoryAvailable: boolean;
  flightHistory: boolean;
  onFlightHistoryChange: (v: boolean) => void;
  timeLabels: boolean;
  onTimeLabelsChange: (v: boolean) => void;
  viewpointsAvailable?: boolean;
  viewpoints?: boolean;
  onViewpointsChange?: (v: boolean) => void;
  flightDockAvailable: boolean;
  flightDock: boolean;
  onFlightDockChange: (v: boolean) => void;
  onOpenLocation: () => void;
  // Whether the visitor's location is on (the dot on the map); the location
  // button is pressed while it is.
  locationEnabled: boolean;
  distanceMetres: number | null;
};

// The data row reads like every other number on the tracker: abbreviated
// from a thousand up, so altitude is "4.1k ft" here as well as on the dial.
function fmt(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return copy.live.unavailablePlaceholder;
  return formatCountWithUnit(value, unit);
}

// The 480 px variant of a theme thumbnail, else the media's own URL.
function thumbnailUrl(
  media: Record<string, { url?: string; variants?: Record<string, string | undefined> } | undefined> | null,
  id: string | null,
): string | null {
  if (id === null || media === null) return null;
  const entry = media[id];
  if (entry === undefined) return null;
  return entry.variants?.["480"] ?? entry.url ?? null;
}

function ThemeSwatch({ theme }: { theme: MapTheme }) {
  const style = {
    "--swatch-bg": theme.chrome.bg,
    "--swatch-ring": theme.chrome.accent,
  } as CSSProperties;
  return <span className={styles.themeSwatch} style={style} aria-hidden data-testid={`tracker-menu-theme-swatch-${theme.key}`} />;
}

export function TrackerMenu(props: TrackerMenuProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const media = useStore((s) => s.snapshot?.media ?? null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const speedMps = useStore((s) => s.live?.speedMps ?? null);
  const headingDeg = useStore((s) => s.live?.headingDeg ?? null);
  const altitudeM = useStore((s) => s.live?.altitudeM ?? null);
  const accuracyM = useStore((s) => s.live?.accuracyM ?? null);
  const wentLiveAt = useStore((s) => s.snapshot?.event?.wentLiveAt ?? null);
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
  const showViewpoints = props.controls.landmarks !== false && props.viewpointsAvailable === true;

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
              const thumb = thumbnailUrl(media, t.thumbnailMediaId);
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-busy={pendingKey === t.key ? true : undefined}
                  onClick={() => {
                    setPendingKey(t.key);
                    void Promise.resolve(props.onThemeChange(t.key)).finally(() => {
                      setPendingKey((k) => (k === t.key ? null : k));
                    });
                  }}
                  className={selected ? `${styles.theme} ${styles.themeSelected} ${styles.onMark}` : styles.theme}
                  data-testid={`tracker-menu-theme-${t.key}`}
                >
                  {thumb !== null ? (
                    <img className={styles.themeThumb} src={thumb} alt="" width={54} height={54} />
                  ) : (
                    <ThemeSwatch theme={t} />
                  )}
                  <span className={styles.themeLabel}>{t.name}</span>
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
              <dd data-testid="data-row-speed">{fmt(speedMph, "mph")}</dd>
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
              <dd>{fmt(altitudeFt, "ft")}</dd>
            </div>
            <div>
              <dt><AccuracyGlyph /><span>Accuracy</span></dt>
              <dd>{fmt(accuracyFt, "ft")}</dd>
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
              <div
                className={props.flightHistory ? `${styles.footerGroup} ${styles.footerGroupOpen}` : styles.footerGroup}
                role="group"
                aria-label={copy.tracker.history}
                data-testid="tracker-menu-route-group"
              >
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
                    <RouteGlyph size={22} />
                  </button>
                </div>
                {props.flightHistory ? (
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
              </div>
            ) : null}
            {showViewpoints ? (
              <div className={styles.footerItem}>
                <span className={styles.footerLabel} aria-hidden>{copy.tracker.landmarks}</span>
                <button
                  type="button"
                  className={styles.footerBtn}
                  aria-pressed={props.viewpoints === true}
                  aria-label={copy.tracker.landmarks}
                  onClick={() => props.onViewpointsChange?.(props.viewpoints !== true)}
                  data-testid="tracker-menu-viewpoints"
                >
                  <ViewpointGlyph size={22} />
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
