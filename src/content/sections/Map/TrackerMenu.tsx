// docs/site.md section 7.6. Tracker menu: the legacy tracker's card in the
// top-right corner. Map styles as round thumbnails with a nickname and an
// accent underline on the active one, then Terrain, Road, and Snow, then
// the data row (a glyph and a value per item), then location, flight
// history, time labels, fit, and close as square buttons.

import { useEffect, useRef } from "react";
import { useStore } from "../../../store/useStore";
import { mpsToMph, metresToFeet, headingToCardinal } from "../../../lib/units";
import { formatMountainTime } from "../../../lib/time";
import { formatDistanceMetres } from "../../../map/userLocation";
import { copy } from "../../../copy/copy";
import type { MapTheme } from "../../../map/themes";
import {
  AccuracyGlyph,
  AltitudeGlyph,
  ClockGlyph,
  CloseGlyph,
  CompassGlyph,
  FitGlyph,
  HistoryGlyph,
  InboxGlyph,
  LocationGlyph,
  PersonPinGlyph,
  RoadGlyph,
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
  onFitHistory: () => void;
  onOpenLocation: () => void;
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
                  <span
                    className={styles.themeThumb}
                    aria-hidden
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${t.timeLabelBg}, ${t.routeColor} 70%, ${t.arrowColor})`,
                    }}
                  />
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
                {formatMountainTime(wentLiveAt) || copy.live.unavailablePlaceholder}
              </dd>
            </div>
            <div>
              <dt><ClockGlyph /><span>Recorded</span></dt>
              <dd data-testid="data-row-recorded">
                {formatMountainTime(recordedAt) || copy.live.unavailablePlaceholder}
              </dd>
            </div>
            <div>
              <dt><InboxGlyph /><span>Received</span></dt>
              <dd data-testid="data-row-received">
                {formatMountainTime(receivedAt) || copy.live.unavailablePlaceholder}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className={styles.footer}>
          {props.controls.location ? (
            <button type="button" className={styles.footerBtn} onClick={props.onOpenLocation} aria-label="Your location">
              <LocationGlyph size={22} />
            </button>
          ) : null}
          {showFlightHistory ? (
            <button
              type="button"
              className={styles.footerBtn}
              aria-pressed={props.flightHistory}
              aria-label="Flight history"
              onClick={() => props.onFlightHistoryChange(!props.flightHistory)}
              data-testid="tracker-menu-flight-history"
            >
              <HistoryGlyph size={22} />
            </button>
          ) : null}
          {showFlightHistory && props.flightHistory ? (
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
          ) : null}
          {showFlightHistory && props.flightHistory ? (
            <button
              type="button"
              className={styles.footerBtn}
              aria-label="Fit history"
              onClick={props.onFitHistory}
              data-testid="tracker-menu-fit-history"
            >
              <FitGlyph size={22} />
            </button>
          ) : null}
          <button type="button" className={styles.close} onClick={props.onClose} aria-label="Close menu">
            <CloseGlyph size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
