// docs/site.md section 7.6. Tracker menu: the studio recipe with the six
// map-style thumbnails and a 3 px accent underline on the active one,
// then terrain/road pills, then toggles, then the data row.

import { useEffect, useRef } from "react";
import { useStore } from "../../../store/useStore";
import { mpsToMph, metresToFeet, headingToCardinal } from "../../../lib/units";
import { copy } from "../../../copy/copy";
import type { MapTheme } from "../../../map/themes";

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
      className="tracker-menu"
      role="dialog"
      aria-label="Tracker menu"
      data-testid="tracker-menu"
    >
      <div className="tracker-menu__header">
        <h2>Tracker</h2>
        <button type="button" onClick={props.onClose} aria-label="Close menu">×</button>
      </div>

      {props.controls.themePicker ? (
        <div
          className="tracker-menu__section tracker-menu__section--theme"
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
                    ? "tracker-menu__theme tracker-menu__theme--selected"
                    : "tracker-menu__theme"
                }
                data-testid={`tracker-menu-theme-${t.key}`}
              >
                <span
                  className="tracker-menu__theme-thumb"
                  aria-hidden
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${t.timeLabelBg}, ${t.routeColor} 70%, ${t.arrowColor})`,
                  }}
                />
                <span className="tracker-menu__theme-label">{t.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {props.controls.terrain ? (
        <div className="tracker-menu__section tracker-menu__section--pills" role="radiogroup" aria-label="Map type">
          <button
            type="button"
            role="radio"
            aria-checked={props.mapType === "terrain"}
            onClick={() => props.onMapTypeChange("terrain")}
            className={
              props.mapType === "terrain"
                ? "tracker-menu__pill tracker-menu__pill--selected"
                : "tracker-menu__pill"
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
                ? "tracker-menu__pill tracker-menu__pill--selected"
                : "tracker-menu__pill"
            }
          >
            Road
          </button>
        </div>
      ) : null}

      <div className="tracker-menu__section tracker-menu__section--toggles">
        {props.controls.snow ? (
          <button
            type="button"
            className="tracker-menu__toggle"
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
              className="tracker-menu__toggle"
              aria-pressed={props.flightHistory}
              onClick={() => props.onFlightHistoryChange(!props.flightHistory)}
              data-testid="tracker-menu-flight-history"
            >
              Flight history
            </button>
            {props.flightHistory ? (
              <button
                type="button"
                className="tracker-menu__toggle"
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
                className="tracker-menu__toggle"
                onClick={props.onFitHistory}
                data-testid="tracker-menu-fit-history"
              >
                Fit history
              </button>
            ) : null}
          </>
        ) : null}

        {props.controls.location ? (
          <button type="button" className="tracker-menu__toggle" onClick={props.onOpenLocation}>
            Location
          </button>
        ) : null}
      </div>

      {props.controls.dataRow ? (
        <dl className="tracker-menu__data-row" data-testid="tracker-menu-data-row">
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
            <dd>
              {props.distanceMetres === null
                ? copy.live.unavailablePlaceholder
                : `${Math.round(props.distanceMetres)} m`}
            </dd>
          </div>
          {wentLiveAt !== null && wentLiveAt !== undefined && wentLiveAt !== "" ? (
            <div>
              <dt>Liftoff</dt>
              <dd>{new Date(wentLiveAt).toLocaleTimeString()}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
