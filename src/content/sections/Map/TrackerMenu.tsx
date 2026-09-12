// docs/site.md section 7.6. Tracker menu: the studio recipe with the six
// map-style thumbnails and a 3 px accent underline on the active one,
// then terrain/road pills, then toggles, then the data row.

import { useEffect, useRef } from "react";
import { useStore } from "../../../store/useStore";
import { mpsToMph, metresToFeet, headingToCardinal } from "../../../lib/units";
import { formatMountainTime } from "../../../lib/time";
import { formatDistanceMetres } from "../../../map/userLocation";
import { copy } from "../../../copy/copy";
import type { MapTheme } from "../../../map/themes";
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
  const showFlightHistoryToggle = props.controls.flightHistory && props.flightHistoryAvailable;

  return (
    <div
      ref={dialogRef}
      className={styles.trackerMenu}
      role="dialog"
      aria-label="Tracker menu"
      data-testid="tracker-menu"
    >
      <div className={styles.header}>
        <h2>Tracker</h2>
        <button type="button" onClick={props.onClose} aria-label="Close menu">×</button>
      </div>

      {props.controls.themePicker ? (
        <div
          className={`${styles.section} ${styles.sectionTheme}`}
          role="radiogroup"
          aria-label="Map style"
        >
          {props.themes.map((t) => {
            const selected = props.themeKey === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => props.onThemeChange(t.key)}
                className={
                  selected
                    ? `${styles.theme} ${styles.themeSelected}`
                    : styles.theme
                }
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

      {props.controls.terrain ? (
        <div className={`${styles.section} ${styles.sectionPills}`} role="radiogroup" aria-label="Map type">
          <button
            type="button"
            role="radio"
            aria-checked={props.mapType === "terrain"}
            onClick={() => props.onMapTypeChange("terrain")}
            className={
              props.mapType === "terrain"
                ? `${styles.pill} ${styles.pillSelected}`
                : styles.pill
            }
          >
            Terrain
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={props.mapType === "roadmap"}
            onClick={() => props.onMapTypeChange("roadmap")}
            className={
              props.mapType === "roadmap"
                ? `${styles.pill} ${styles.pillSelected}`
                : styles.pill
            }
          >
            Road
          </button>
        </div>
      ) : null}

      <div className={`${styles.section} ${styles.sectionToggles}`}>
        {props.controls.snow ? (
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={props.snow}
            onClick={() => props.onSnowChange(!props.snow)}
            data-testid="tracker-menu-snow"
          >
            Snow
          </button>
        ) : null}

        {showFlightHistoryToggle ? (
          <>
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={props.flightHistory}
              onClick={() => props.onFlightHistoryChange(!props.flightHistory)}
              data-testid="tracker-menu-flight-history"
            >
              Flight history
            </button>
            {props.flightHistory ? (
              <button
                type="button"
                className={styles.toggle}
                aria-pressed={props.timeLabels}
                onClick={() => props.onTimeLabelsChange(!props.timeLabels)}
                data-testid="tracker-menu-time-labels"
              >
                Time labels
              </button>
            ) : null}
            {props.flightHistory ? (
              <button
                type="button"
                className={styles.toggle}
                onClick={props.onFitHistory}
                data-testid="tracker-menu-fit-history"
              >
                Fit history
              </button>
            ) : null}
          </>
        ) : null}

        {props.controls.location ? (
          <button type="button" className={styles.toggle} onClick={props.onOpenLocation}>
            Location
          </button>
        ) : null}
      </div>

      {props.controls.dataRow ? (
        <dl className={styles.dataRow} data-testid="tracker-menu-data-row">
          <div>
            <dt>Speed</dt>
            <dd data-testid="data-row-speed">{fmt(speedMph, "mph", 0)}</dd>
          </div>
          <div>
            <dt>Heading</dt>
            <dd>
              {headingDeg === null
                ? copy.live.unavailablePlaceholder
                : `${Math.round(headingDeg)}° ${cardinal ?? ""}`.trim()}
            </dd>
          </div>
          <div>
            <dt>Altitude</dt>
            <dd>{fmt(altitudeFt, "ft", 0)}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd>{fmt(accuracyFt, "ft", 0)}</dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd data-testid="data-row-distance">
              {props.distanceMetres === null
                ? copy.live.unavailablePlaceholder
                : formatDistanceMetres(props.distanceMetres)}
            </dd>
          </div>
          <div>
            <dt>Liftoff</dt>
            <dd data-testid="data-row-liftoff">
              {formatMountainTime(wentLiveAt) || copy.live.unavailablePlaceholder}
            </dd>
          </div>
          <div>
            <dt>Recorded</dt>
            <dd data-testid="data-row-recorded">
              {formatMountainTime(recordedAt) || copy.live.unavailablePlaceholder}
            </dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd data-testid="data-row-received">
              {formatMountainTime(receivedAt) || copy.live.unavailablePlaceholder}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
