// docs/site.md section 7.6. Tracker menu: theme picker, terrain or road,
// snow, route lines, time labels, location button, data row, close. Each
// entry is present only when its control is on.

import { useEffect, useRef } from "react";
import { useStore } from "../../../store/useStore";
import { mpsToMph, metresToFeet, headingToCardinal } from "../../../lib/units";
import { copy } from "../../../copy/copy";
import type { MapTheme } from "../../../map/themes";

type Toggles = {
  themePicker: boolean;
  terrain: boolean;
  snow: boolean;
  routeLines: boolean;
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
  routeLines: boolean;
  onRouteLinesChange: (v: boolean) => void;
  timeLabels: boolean;
  onTimeLabelsChange: (v: boolean) => void;
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
          aria-label="Map theme"
        >
          {props.themes.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={props.themeKey === t.key}
              onClick={() => props.onThemeChange(t.key)}
              className={
                props.themeKey === t.key
                  ? "tracker-menu__theme tracker-menu__theme--selected"
                  : "tracker-menu__theme"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {props.controls.terrain ? (
        <button
          type="button"
          aria-pressed={props.mapType === "terrain"}
          onClick={() =>
            props.onMapTypeChange(props.mapType === "terrain" ? "roadmap" : "terrain")
          }
        >
          Terrain
        </button>
      ) : null}

      {props.controls.snow ? (
        <button
          type="button"
          aria-pressed={props.snow}
          onClick={() => props.onSnowChange(!props.snow)}
        >
          Snow
        </button>
      ) : null}

      {props.controls.routeLines ? (
        <button
          type="button"
          aria-pressed={props.routeLines}
          onClick={() => props.onRouteLinesChange(!props.routeLines)}
        >
          Route lines
        </button>
      ) : null}

      {props.controls.timeLabels ? (
        <button
          type="button"
          aria-pressed={props.timeLabels}
          onClick={() => props.onTimeLabelsChange(!props.timeLabels)}
        >
          Time labels
        </button>
      ) : null}

      {props.controls.location ? (
        <button type="button" onClick={props.onOpenLocation}>
          Location
        </button>
      ) : null}

      {props.controls.dataRow ? (
        <dl className="tracker-menu__data-row" data-testid="tracker-menu-data-row">
          <div>
            <dt>Speed</dt>
            <dd>{fmt(speedMph, "mph", 0)}</dd>
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
