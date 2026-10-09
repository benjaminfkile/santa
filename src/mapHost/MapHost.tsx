// docs/site.md sections 8.9 and 8.10. The MapLibre map host, in the
// `tracker-maplibre` chunk, which alone imports MapLibre and PMTiles (the
// `routemap` chunk). In route mode (`route_preview`) it draws the route
// over the event's map (`trackerMap`, read once when the map mounts) in
// the given theme's style: the body comes through the theme's
// `getStyle()` (fetched once per page, so the section's own early call
// has usually brought it), and a new theme (the section re-resolves it on
// every scheme change) is applied to the same map as a style diff once
// its body is in hand. The event box (`trackerBbox`) is the pan limit and
// the least zoom. Any failure (the style body, the style, the tiles,
// WebGL) is logged once and reported through `onFail`. The map is
// destroyed on unmount. `marks` are drawn as dots on the path and
// `timeLabels` as labelled dots beside them; `poiKinds` is the place
// filter; `viewpoints`, `arrows`, `arrowScale`, `routeWidthScale`, and
// `labelScale` pass through to the route layers; `viewpointMarkers`
// stands each caller's element on its point as a marker (the caller
// renders the viewpoint badges and buttons into them); `startElement`
// stands as a marker on the path's first point (the caller builds it, so
// this chunk imports neither react-dom nor the icon modules).
// `labelMinZoom` passes through to the map (the names hide below it) and
// `onViewpointClick` is called, as it is at the time, with the point of a
// clicked viewpoint dot.
// The control stack sits at the top right of the frame, each button
// carrying `controlClassName` (the caller passes the icon button recipe,
// which stays out of this chunk because the tracker shares it): a
// fullscreen button when `fullscreenControl` is set (the caller owns the
// fullscreen state and passes `fullscreen` and `onToggleFullscreen`;
// each change of `fullscreen` resizes the map and refits the path), and a
// terrain toggle when `terrainControl` is set, the event's map has a
// terrain URL, and the theme has a layer on the `terrain` source. The
// terrain choice is kept in storage under TERRAIN_KEY ("on" or "off", on
// when absent) and applied to every style the map builds, so a theme
// switch keeps it.
// `renderer` picks the branch: `maplibre` (the default) is the host above;
// `google` draws the same options with Google primitives (site.md 8.9,
// Route mode on Google) through the `map` chunk's loader and route
// drawing (src/map/routeMode.ts), both imported with `import()`, in the
// given Google theme's style array; a new theme is applied to the same
// map. The same controls stand over both; on Google the terrain toggle
// switches the map type and shows whenever `terrainControl` is set.

import { useEffect, useMemo, useRef, useState } from "react";
import type { StyleSpecification } from "maplibre-gl";
import { copy } from "../copy/copy";
import { storageGet, storageSet } from "../lib/storage";
import type { MapTheme } from "../map/themes";
import type { Renderer } from "../map/renderer";
import type { MapsLibs } from "../map/loadMaps";
import type { GoogleRouteHandle, GoogleRouteTheme } from "../map/routeMode";
import { toBbox, type Bbox } from "../map/bounds";
import {
  mountRouteMap,
  type HostTheme,
  type LatLng,
  type RouteMapHandle,
  type TimeLabel,
  type TrackerMap,
  type Viewpoint,
  type ViewpointMarker,
} from "./handle";
import { hasTerrainLayers } from "./themeStyle";
import * as styles from "./MapHost.module.css";

export const TERRAIN_KEY = "wmsfo.routeMap.terrain";

const NO_MARKS: readonly LatLng[] = [];
const NO_LABELS: readonly TimeLabel[] = [];
const NO_MARKERS: readonly ViewpointMarker[] = [];

export type MapHostProps = {
  mode: "route";
  renderer?: Renderer;
  theme: MapTheme;
  trackerMap: TrackerMap;
  trackerBbox: Partial<Bbox> | null;
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  timeLabels?: readonly TimeLabel[];
  poiKinds?: readonly string[] | null;
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

function isStyle(body: unknown): body is StyleSpecification {
  return (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Array.isArray((body as { layers?: unknown }).layers) &&
    typeof (body as { sources?: unknown }).sources === "object"
  );
}

// The renderer picks the branch; each branch keeps its own map, so a
// change of renderer builds the other one in its place.
export function MapHost(props: MapHostProps) {
  return props.renderer === "google" ? <GoogleRouteHost {...props} /> : <MapLibreRouteHost {...props} />;
}

function MapLibreRouteHost({
  theme,
  trackerMap,
  trackerBbox,
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
}: MapHostProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<RouteMapHandle | null>(null);
  const [drawn, setDrawn] = useState<HostTheme | null>(null);
  const [mounted, setMounted] = useState(false);
  const [terrainOn, setTerrainOn] = useState(() => storageGet(TERRAIN_KEY) !== "off");
  const terrainAvailable =
    drawn !== null &&
    trackerMap.terrainUrl !== null &&
    trackerMap.terrainUrl !== "" &&
    hasTerrainLayers(drawn.style);
  const showTerrain = terrainControl && terrainAvailable;
  const terrain = showTerrain && terrainOn;
  const failed = useRef(false);
  const latest = useRef({ onFail, onViewpointClick });

  useEffect(() => {
    latest.current = { onFail, onViewpointClick };
  });

  function fail(error: unknown): void {
    if (failed.current) return;
    failed.current = true;
    console.warn("map host: the map did not load", error);
    latest.current.onFail();
  }

  // The theme's body, then the theme as the handle draws it.
  useEffect(() => {
    let cancelled = false;
    theme
      .getStyle()
      .then((body) => {
        if (cancelled) return;
        if (!isStyle(body)) throw new Error(`The theme ${theme.key} has no MapLibre style`);
        setDrawn({
          key: theme.key,
          spriteUrl: theme.spriteUrl,
          overlay: theme.overlay,
          chrome: theme.chrome,
          style: body,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) fail(error);
      });
    return () => {
      cancelled = true;
    };
    // fail reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const bbox = useMemo(() => toBbox(trackerBbox), [trackerBbox]);
  const update = {
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
    terrain,
  };
  const latestUpdate = useRef(update);
  latestUpdate.current = update;
  const mapInputs = useRef({ trackerMap, bbox, startElement });

  const ready = drawn !== null;
  useEffect(() => {
    const host = hostRef.current;
    if (!ready || host === null || handleRef.current !== null || failed.current) return;
    try {
      const { trackerMap: map, bbox: box, startElement: start } = mapInputs.current;
      handleRef.current = mountRouteMap({
        container: host,
        trackerMap: map,
        bbox: box,
        theme: drawn,
        ...latestUpdate.current,
        startElement: start,
        onViewpointClick: (point) => latest.current.onViewpointClick?.(point),
        onError: fail,
      });
      setMounted(true);
    } catch (error) {
      fail(error);
    }
    // The map mounts once, when the first body arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(
    () => () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (drawn === null) return;
    handleRef.current?.update({
      theme: drawn,
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
      terrain,
    });
  }, [
    drawn,
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
        data-map-theme={drawn?.key}
        data-terrain={terrain ? "on" : "off"}
      />
      {mounted ? (
        <RouteControls
          showFullscreen={showFullscreen}
          showTerrain={showTerrain}
          fullscreen={fullscreen}
          terrainOn={terrainOn}
          controlClassName={controlClassName}
          onToggleFullscreen={onToggleFullscreen}
          onToggleTerrain={toggleTerrain}
        />
      ) : null}
    </>
  );
}

type RouteControlsProps = {
  showFullscreen: boolean;
  showTerrain: boolean;
  fullscreen: boolean;
  terrainOn: boolean;
  controlClassName?: string;
  onToggleFullscreen?: () => void;
  onToggleTerrain: () => void;
};

// The control stack at the top right of the frame, on both renderers.
function RouteControls({
  showFullscreen,
  showTerrain,
  fullscreen,
  terrainOn,
  controlClassName,
  onToggleFullscreen,
  onToggleTerrain,
}: RouteControlsProps) {
  if (!showFullscreen && !showTerrain) return null;
  return (
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
          onClick={onToggleTerrain}
          data-testid="route-map-terrain"
        >
          <TerrainIcon />
        </button>
      ) : null}
    </div>
  );
}

// A failed Google library load retries by itself GOOGLE_RETRIES times,
// waiting GOOGLE_RETRY_BASE_MS and doubling, before the failure counts.
export const GOOGLE_RETRIES = 3;
export const GOOGLE_RETRY_BASE_MS = 1000;

type GoogleModules = {
  libs: MapsLibs;
  mountGoogleRoute: typeof import("../map/routeMode").mountGoogleRoute;
};

// Route mode on Google (site.md 8.9): the Google loader and the route
// drawing come from the `map` chunk through `import()`, the libraries
// with the retries above, and the theme's style array through
// `getStyle()`; the map is built once both are in hand and a new theme is
// applied to the same map through `setOptions`. Terrain is the map type,
// so the toggle shows whenever `terrainControl` is set. Any failure (the
// chunk, the libraries after their retries, the style) is logged once and
// reported through `onFail`.
function GoogleRouteHost({
  theme,
  trackerBbox,
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
}: MapHostProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<GoogleRouteHandle | null>(null);
  const [modules, setModules] = useState<GoogleModules | null>(null);
  const [drawn, setDrawn] = useState<GoogleRouteTheme | null>(null);
  const [mounted, setMounted] = useState(false);
  const [terrainOn, setTerrainOn] = useState(() => storageGet(TERRAIN_KEY) !== "off");
  const showTerrain = terrainControl;
  const terrain = showTerrain && terrainOn;
  const failed = useRef(false);
  const latest = useRef({ onFail, onViewpointClick });

  useEffect(() => {
    latest.current = { onFail, onViewpointClick };
  });

  function fail(error: unknown): void {
    if (failed.current) return;
    failed.current = true;
    console.warn("map host: the Google map did not load", error);
    latest.current.onFail();
  }

  // The `map` chunk's loader and route drawing, then the libraries.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const [loader, routeMode] = await Promise.all([
          import("../map/loadMaps"),
          import("../map/routeMode"),
        ]);
        for (let attempt = 0; ; attempt++) {
          if (cancelled) return;
          try {
            const libs = await loader.loadMaps();
            if (!cancelled) setModules({ libs, mountGoogleRoute: routeMode.mountGoogleRoute });
            return;
          } catch (error) {
            if (attempt >= GOOGLE_RETRIES) throw error;
            await new Promise<void>((resolve) => {
              timer = setTimeout(resolve, GOOGLE_RETRY_BASE_MS * 2 ** attempt);
            });
          }
        }
      } catch (error) {
        if (!cancelled) fail(error);
      }
    })();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
    // fail reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The theme's style array, then the theme as the map draws it.
  useEffect(() => {
    let cancelled = false;
    theme
      .getStyle()
      .then((body) => {
        if (cancelled) return;
        if (!Array.isArray(body)) throw new Error(`The theme ${theme.key} has no Google style`);
        setDrawn({ key: theme.key, overlay: theme.overlay, chrome: theme.chrome, style: body });
      })
      .catch((error: unknown) => {
        if (!cancelled) fail(error);
      });
    return () => {
      cancelled = true;
    };
    // fail reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const bbox = useMemo(() => toBbox(trackerBbox), [trackerBbox]);
  const update = {
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
    terrain,
  };
  const latestUpdate = useRef(update);
  latestUpdate.current = update;
  const mapInputs = useRef({ bbox, startElement });

  const ready = drawn !== null && modules !== null;
  useEffect(() => {
    const host = hostRef.current;
    if (!ready || host === null || handleRef.current !== null || failed.current) return;
    try {
      const { bbox: box, startElement: start } = mapInputs.current;
      handleRef.current = modules.mountGoogleRoute(modules.libs, host, {
        bbox: box,
        theme: drawn,
        ...latestUpdate.current,
        startElement: start,
        onViewpointClick: (point) => latest.current.onViewpointClick?.(point),
      });
      setMounted(true);
    } catch (error) {
      fail(error);
    }
    // The map mounts once, when the libraries and the first style are in hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(
    () => () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (drawn === null) return;
    handleRef.current?.update({
      theme: drawn,
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
      terrain,
    });
  }, [
    drawn,
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

  return (
    <>
      <div
        ref={hostRef}
        className={styles.routeMapHost}
        role="region"
        aria-label={ariaLabel}
        data-testid="route-map"
        data-renderer="google"
        data-map-theme={drawn?.key}
        data-terrain={terrain ? "on" : "off"}
      />
      {mounted ? (
        <RouteControls
          showFullscreen={fullscreenControl && onToggleFullscreen !== undefined}
          showTerrain={showTerrain}
          fullscreen={fullscreen}
          terrainOn={terrainOn}
          controlClassName={controlClassName}
          onToggleFullscreen={onToggleFullscreen}
          onToggleTerrain={toggleTerrain}
        />
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
