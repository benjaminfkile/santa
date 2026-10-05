// docs/site.md section 8.9. The `map` style's map host, in the `routemap`
// chunk with MapLibre: mounts the route map into its host and passes it
// the site appearance (`<html data-theme>`) whenever that changes, so
// light, dark, and system switch the map style live. Any failure (the
// archive, the style, WebGL) is logged once and reported through
// `onFail`, which hands the section back to the image rendering. The map
// is destroyed on unmount. `marks` are drawn as dots on the path and
// `timeLabels` as labelled dots beside them; `poiKinds`, `viewpoints`,
// `arrows`, `arrowScale`, `routeWidthScale`, and `labelScale` pass
// through to the style options of the same names; `viewpointMarkers` stands each caller's
// element on its point as a marker (the caller renders the viewpoint
// badges and buttons into them); `startElement` stands as a marker on the
// path's first point (the caller builds it, so this chunk imports neither
// react-dom nor the icon modules). `labelMinZoom` passes through to the
// map (the names hide below it) and `onViewpointClick` is called, as it is
// at the time, with the point of a clicked viewpoint dot.
// The control stack sits at the top right of the frame, each button
// carrying `controlClassName` (the caller passes the icon button recipe,
// which stays out of this chunk because the tracker shares it): a
// fullscreen button when `fullscreenControl` is set
// (the caller owns the fullscreen state and passes `fullscreen` and
// `onToggleFullscreen`; each change of `fullscreen` resizes the map and
// refits the path), and a terrain toggle when `terrainControl` is set and
// the terrain archive exists (probed once per page load after the map
// mounts). The terrain choice is kept in storage under TERRAIN_KEY
// ("on" or "off", on when absent) and applied to every style the map
// builds, so an appearance switch keeps it.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getResolved, subscribeScheme } from "../content/theme/colorScheme";
import { copy } from "../copy/copy";
import { storageGet, storageSet } from "../lib/storage";
import {
  mountRouteMap,
  probeTerrain,
  type Appearance,
  type Viewpoint,
  type ViewpointMarker,
  type LatLng,
  type RouteMapHandle,
  type TimeLabel,
} from "./index";
import * as styles from "./RouteMap.module.css";

export const TERRAIN_KEY = "wmsfo.routeMap.terrain";

function useAppearance(): Appearance {
  return useSyncExternalStore(subscribeScheme, getResolved, () => "light");
}

const NO_MARKS: readonly LatLng[] = [];
const NO_LABELS: readonly TimeLabel[] = [];
const NO_MARKERS: readonly ViewpointMarker[] = [];

export type RouteMapProps = {
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  timeLabels?: readonly TimeLabel[];
  poiKinds?: readonly string[];
  viewpoints?: readonly Viewpoint[];
  viewpointMarkers?: readonly ViewpointMarker[];
  arrows?: boolean;
  arrowScale?: number;
  routeWidthScale?: number;
  labelScale?: number;
  labelMinZoom?: number;
  onViewpointClick?: (point: { lat: number; lng: number }) => void;
  startElement?: HTMLElement;
  ariaLabel?: string;
  fullscreenControl?: boolean;
  terrainControl?: boolean;
  controlClassName?: string;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onFail: () => void;
};

export function RouteMap({
  path,
  marks = NO_MARKS,
  timeLabels = NO_LABELS,
  poiKinds,
  viewpoints,
  viewpointMarkers = NO_MARKERS,
  arrows = false,
  arrowScale,
  routeWidthScale,
  labelScale,
  labelMinZoom,
  onViewpointClick,
  startElement,
  ariaLabel,
  fullscreenControl = false,
  terrainControl = false,
  controlClassName,
  fullscreen = false,
  onToggleFullscreen,
  onFail,
}: RouteMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<RouteMapHandle | null>(null);
  const appearance = useAppearance();
  const [mounted, setMounted] = useState(false);
  const [terrainAvailable, setTerrainAvailable] = useState(false);
  const [terrainOn, setTerrainOn] = useState(() => storageGet(TERRAIN_KEY) !== "off");
  const showTerrain = terrainControl && terrainAvailable;
  const terrain = showTerrain && terrainOn;
  const latest = useRef({
    path,
    marks,
    timeLabels,
    poiKinds,
    viewpoints,
    viewpointMarkers,
    arrows,
    arrowScale,
    routeWidthScale,
    labelScale,
    labelMinZoom,
    onViewpointClick,
    startElement,
    appearance,
    terrain,
    onFail,
  });

  useEffect(() => {
    latest.current = {
    path,
    marks,
    timeLabels,
    poiKinds,
    viewpoints,
    viewpointMarkers,
    arrows,
    arrowScale,
    routeWidthScale,
    labelScale,
    labelMinZoom,
    onViewpointClick,
    startElement,
    appearance,
    terrain,
    onFail,
  };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    let cancelled = false;
    let reported = false;
    function fail(error: unknown): void {
      if (cancelled || reported) return;
      reported = true;
      console.warn("route map: the map did not load", error);
      latest.current.onFail();
    }
    mountRouteMap({
      container: host,
      path: latest.current.path,
      marks: latest.current.marks,
      timeLabels: latest.current.timeLabels,
      poiKinds: latest.current.poiKinds,
      viewpoints: latest.current.viewpoints,
      viewpointMarkers: latest.current.viewpointMarkers,
      arrows: latest.current.arrows,
      arrowScale: latest.current.arrowScale,
      routeWidthScale: latest.current.routeWidthScale,
      labelScale: latest.current.labelScale,
      labelMinZoom: latest.current.labelMinZoom,
      onViewpointClick: (point) => latest.current.onViewpointClick?.(point),
      appearance: latest.current.appearance,
      terrain: latest.current.terrain,
      startElement: latest.current.startElement,
      onError: fail,
    })
      .then((handle) => {
        if (cancelled) {
          handle.destroy();
          return;
        }
        handleRef.current = handle;
        const now = latest.current;
        handle.update({
          path: now.path,
          marks: now.marks,
          timeLabels: now.timeLabels,
          poiKinds: now.poiKinds,
          viewpoints: now.viewpoints,
          viewpointMarkers: now.viewpointMarkers,
          arrows: now.arrows,
          arrowScale: now.arrowScale,
          routeWidthScale: now.routeWidthScale,
          labelScale: now.labelScale,
          labelMinZoom: now.labelMinZoom,
          appearance: now.appearance,
          terrain: now.terrain,
        });
        setMounted(true);
      })
      .catch(fail);
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mounted || !terrainControl) return;
    let cancelled = false;
    void probeTerrain().then((exists) => {
      if (!cancelled) setTerrainAvailable(exists);
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, terrainControl]);

  useEffect(() => {
    handleRef.current?.update({
      path,
      marks,
      timeLabels,
      poiKinds,
      viewpoints,
      viewpointMarkers,
      arrows,
      arrowScale,
      routeWidthScale,
      labelScale,
      labelMinZoom,
      appearance,
      terrain,
    });
  }, [
    path,
    marks,
    timeLabels,
    poiKinds,
    viewpoints,
    viewpointMarkers,
    arrows,
    arrowScale,
    routeWidthScale,
    labelScale,
    labelMinZoom,
    appearance,
    terrain,
  ]);

  const fullscreenSeen = useRef(fullscreen);
  useEffect(() => {
    if (fullscreenSeen.current === fullscreen) return;
    fullscreenSeen.current = fullscreen;
    handleRef.current?.refit();
  }, [fullscreen]);

  function toggleTerrain(): void {
    const next = !terrainOn;
    setTerrainOn(next);
    storageSet(TERRAIN_KEY, next ? "on" : "off");
  }

  const showFullscreen = fullscreenControl && onToggleFullscreen !== undefined;

  return (
    <>
      <div
        ref={hostRef}
        className={styles.routeMapHost}
        role="region"
        aria-label={ariaLabel}
        data-testid="route-map"
        data-appearance={appearance}
        data-terrain={terrain ? "on" : "off"}
      />
      {mounted && (showFullscreen || showTerrain) ? (
        <div className={styles.routeMapControls} data-testid="route-map-controls">
          {showFullscreen ? (
            <button
              type="button"
              className={controlClassName}
              aria-label={fullscreen ? copy.map.routeMap.exitFullscreen : copy.map.routeMap.fullscreen}
              aria-pressed={fullscreen}
              onClick={onToggleFullscreen}
              data-testid="route-map-fullscreen"
            >
              {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          ) : null}
          {showTerrain ? (
            <button
              type="button"
              className={controlClassName}
              aria-label={copy.map.routeMap.terrain}
              aria-pressed={terrainOn}
              onClick={toggleTerrain}
              data-testid="route-map-terrain"
            >
              <TerrainIcon />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.75",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M9 4v5H4" />
      <path d="M15 4v5h5" />
      <path d="M9 20v-5H4" />
      <path d="M15 20v-5h5" />
    </svg>
  );
}

function TerrainIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M2 20l7-12 4 6 3-4 6 10z" />
      <path d="M7.5 10.5l1.5 1.5 1.5-1.5" />
    </svg>
  );
}
