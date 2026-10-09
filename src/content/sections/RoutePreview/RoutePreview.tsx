// docs/site.md section 7.4 and 8.9. `route_preview` renders the heading,
// `data.disclaimer` in the disclaimer recipe (above the map, when set), and
// the route map. It decides from the path alone whether a map can render
// (a route map with two or more points); with fewer points it renders the
// heading and `emptyText`, or nothing when `emptyText` is empty, and never
// draws a picture. Otherwise it reports the renderer choice of 8.1 as the
// `route` surface. On `maplibre` it lazy-imports the map host
// (`src/mapHost/MapHost.tsx`, the `tracker-maplibre` chunk) and, in
// parallel, the theme loader, then resolves the route theme: the event's
// enabled MapLibre theme carrying the default flag for the page's
// appearance (`<html data-theme>`), else the first one, re-resolved on
// every scheme change. The theme's style body is fetched as soon as the
// theme is known, alongside the host's chunk. On `google`, or when the
// host fails (the chunk, the theme, the style, the tiles), the section
// renders the heading and `emptyText`. The start marker (routeStartMarker:
// a gold star flag and a "Starts here" label) stands on the path's first
// point and the end keeps its circle; nothing on the map moves. With two
// or more `event.routeMap.timeline` entries the map also carries a dot at
// every entry and a labelled dot at every interior multiple of the time
// label interval; with fewer, only the path and its end are drawn. The
// frame sits in one wrapper, the fullscreen target (useRouteMapFullscreen),
// rendered through TakeoverPortal so the takeover sits under
// document.body. The map region is labelled `copy.map.routeMap.region`,
// which speaks the start.
// The display and the controls come from `event.routeMapConfig`
// (routeMapConfig), each value falling back to its default; a null config
// draws the default map. The viewpoints come from the site settings'
// `landmarks` and the places from `places.routeMap`; absent means none.
// The map carries a fullscreen button and a terrain toggle unless
// `controls.fullscreen` or `controls.terrain` is false. The
// `places.routeMap.kinds` list reaches the host as its place filter and
// the viewpoints as its viewpoints, each name the label. A viewpoint with
// an icon or a description also gets a marker and its popover
// (RouteViewpoints). The names and the time label text start at
// LABEL_MIN_ZOOM (`labelMinZoom`); a click on a viewpoint's style dot
// opens the popover of the viewpoint at that point, so every viewpoint
// opens its popover. The five display values (time label interval,
// arrows, arrow size, route width, label size) reach the host as the
// label interval, `arrows`, `arrowScale`, `routeWidthScale`, and
// `labelScale`. The section data carries the heading, the disclaimer, and
// the empty text; any other key in a published document is ignored.

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { store, useStore } from "../../../store/useStore";
import { routeMapPath, type LatLng } from "./routeMapPath";
import { routeMapTimeline, routeTimeLabels, type TimelineLabel } from "./routeTimelineData";
import { createRouteStartMarker } from "./routeStartMarker";
import { useRouteViewpoints } from "./RouteViewpoints";
import { resolvePlaces, resolveViewpoints, resolveRouteMapConfig } from "./routeMapConfig";
import { useRouteMapFullscreen } from "./useRouteMapFullscreen";
import { TakeoverPortal } from "../../../lib/TakeoverPortal";
import { getResolved, subscribeScheme } from "../../theme/colorScheme";
import { reportRenderer, type Renderer } from "../../../map/renderer";
import type { MapHostProps } from "../../../mapHost/MapHost";
import { copy } from "../../../copy/copy";
import * as styles from "./RoutePreview.module.css";
import * as ibtn from "../../../ui/IconButton.module.css";

type ThemesModule = typeof import("../../../map/themes");

// The least zoom at which the viewpoint names and the time label text show.
const LABEL_MIN_ZOOM = 12;

const NO_MARKS: readonly LatLng[] = [];
const NO_LABELS: readonly TimelineLabel[] = [];

function loadHost() {
  return import("../../../mapHost/MapHost");
}

// The map host, in the `tracker-maplibre` chunk. A chunk that fails to
// load resolves to a component that reports the failure, so the section
// renders its empty text.
const LazyMapHost = lazy(() =>
  loadHost()
    .then((mod) => ({ default: mod.MapHost }))
    .catch((error: unknown) => ({
      default: function MapHostUnavailable({ onFail }: MapHostProps) {
        useEffect(() => {
          console.warn("route map: the map chunk did not load", error);
          onFail();
        }, [onFail]);
        return null;
      },
    })),
);

function useAppearance(): "light" | "dark" {
  return useSyncExternalStore(subscribeScheme, getResolved, () => "light");
}

type RoutePreviewData = {
  heading?: string | null;
  emptyText?: string | null;
  disclaimer?: string | null;
};

export const RoutePreview: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as RoutePreviewData;
  const emptyText = d.emptyText ?? null;
  const routeMap = useStore((s) => s.snapshot?.event?.routeMap ?? null);
  const routeMapConfig = useStore((s) => s.snapshot?.event?.routeMapConfig ?? null);
  const rawTrackerMap = useStore((s) => s.snapshot?.event?.trackerMap ?? null);
  const trackerBbox = useStore((s) => s.snapshot?.event?.trackerBbox ?? null);
  const themeRows = useStore((s) => s.snapshot?.trackerThemes ?? null);
  const tilesUrl = rawTrackerMap?.tilesUrl ?? "";
  const terrainUrl = rawTrackerMap?.terrainUrl ?? null;
  const minZoom = rawTrackerMap?.minZoom;
  const maxZoom = rawTrackerMap?.maxZoom;
  const trackerMap = useMemo(
    () => ({ tilesUrl, terrainUrl, minZoom, maxZoom }),
    [tilesUrl, terrainUrl, minZoom, maxZoom],
  );
  const event = useSnapshotEvent();
  const content = bundle.content;
  const [mapFailed, setMapFailed] = useState(false);
  const onMapFail = useCallback(() => setMapFailed(true), []);

  const path = useMemo(() => routeMapPath(routeMap), [routeMap]);
  const parsedTimeline = useMemo(() => routeMapTimeline(routeMap), [routeMap]);
  const timeline = parsedTimeline.length >= 2 ? parsedTimeline : null;
  const marks = useMemo(
    () => (timeline === null ? NO_MARKS : timeline.map(({ lat, lng }) => ({ lat, lng }))),
    [timeline],
  );
  const config = useMemo(() => resolveRouteMapConfig(routeMapConfig), [routeMapConfig]);
  const display = config.display;
  const labelEvery = display.timeLabelIntervalMinutes;
  const timeLabels = useMemo(
    () => (timeline === null ? NO_LABELS : routeTimeLabels(timeline, labelEvery)),
    [timeline, labelEvery],
  );
  const settingsViewpoints = content?.settings?.landmarks;
  const viewpointList = useMemo(() => resolveViewpoints(settingsViewpoints), [settingsViewpoints]);
  const settingsPlaces = content?.settings?.places;
  const routeMapPlaces = useMemo(() => resolvePlaces(settingsPlaces).routeMap, [settingsPlaces]);
  const viewpoints = useRouteViewpoints(viewpointList, bundle);
  const { openIndex } = viewpoints;
  const onViewpointClick = useCallback(
    (point: { lat: number; lng: number }) => {
      const index = viewpointList.findIndex((l) => l.lat === point.lat && l.lng === point.lng);
      if (index >= 0) openIndex(index);
    },
    [viewpointList, openIndex],
  );
  const [startElement] = useState(createRouteStartMarker);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const fullscreen = useRouteMapFullscreen(stageRef);

  const canMap = path.length >= 2;
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  useLayoutEffect(() => {
    setRenderer(canMap ? reportRenderer("route", store.getState().snapshot) : null);
  }, [canMap, rawTrackerMap, themeRows]);

  // The theme loader, imported alongside the host's chunk.
  const [themesModule, setThemesModule] = useState<ThemesModule | null>(null);
  const wantsHost = renderer === "maplibre" && !mapFailed;
  useEffect(() => {
    if (!wantsHost || themesModule !== null) return;
    let cancelled = false;
    void loadHost().catch(() => {});
    import("../../../map/themes").then(
      (mod) => {
        if (!cancelled) setThemesModule(mod);
      },
      (error: unknown) => {
        if (cancelled) return;
        console.warn("route map: the theme loader did not load", error);
        setMapFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [wantsHost, themesModule]);

  const appearance = useAppearance();
  const theme = useMemo(() => {
    if (themesModule === null) return null;
    const themes = themesModule.loadThemes({ trackerThemes: themeRows ?? undefined });
    return themesModule.resolveDefaultTheme(themes, "maplibre", appearance);
  }, [themesModule, themeRows, appearance]);

  // The style body starts with the chunk; the host reports a failure.
  useEffect(() => {
    theme?.getStyle().catch(() => {});
  }, [theme]);

  const noTheme = themesModule !== null && theme === null;

  if (canMap && renderer !== "google" && !mapFailed && !noTheme) {
    return (
      <div className={`${styles.routePreview} ${styles.routePreviewMap}`} data-testid="route-preview-map">
        {d.heading ? (
          <h2 className={styles.routePreviewHeading}>
            <Inline text={d.heading} bundle={bundle} event={event} />
          </h2>
        ) : null}
        {d.disclaimer ? (
          <div className={styles.disclaimerRecipe} role="note">
            <DisclaimerIcon />
            <p>
              <Inline text={d.disclaimer} bundle={bundle} event={event} />
            </p>
          </div>
        ) : null}
        <TakeoverPortal active={fullscreen.mode === "takeover"}>
          <div
            ref={stageRef}
            className={
              fullscreen.mode === "takeover"
                ? `${styles.routeMapStage} ${styles.routeMapStageTakeover}`
                : styles.routeMapStage
            }
            data-testid="route-map-stage"
            data-fullscreen={fullscreen.mode}
          >
            <div className={styles.routeMap} data-testid="route-map-frame">
              {theme !== null ? (
                <Suspense fallback={null}>
                  <LazyMapHost
                    mode="route"
                    theme={theme}
                    trackerMap={trackerMap}
                    trackerBbox={trackerBbox}
                    path={path}
                    marks={marks}
                    timeLabels={timeLabels}
                    poiKinds={routeMapPlaces}
                    viewpoints={viewpoints.styleViewpoints}
                    viewpointMarkers={viewpoints.markers}
                    arrows={display.arrows}
                    arrowScale={display.arrowScale}
                    routeWidthScale={display.routeWidthScale}
                    labelScale={display.labelScale}
                    labelMinZoom={LABEL_MIN_ZOOM}
                    onViewpointClick={onViewpointClick}
                    startElement={startElement}
                    ariaLabel={copy.map.routeMap.region}
                    fullscreenControl={config.controls.fullscreen}
                    terrainControl={config.controls.terrain}
                    controlClassName={ibtn.ibtn}
                    fullscreen={fullscreen.mode !== "off"}
                    onToggleFullscreen={fullscreen.toggle}
                    onFail={onMapFail}
                  />
                </Suspense>
              ) : null}
              {viewpoints.popover}
            </div>
          </div>
        </TakeoverPortal>
        {viewpoints.portals}
      </div>
    );
  }

  if (!emptyText) return null;
  return (
    <div className={`${styles.routePreview} ${styles.routePreviewEmpty}`} data-testid="route-preview-empty">
      {d.heading ? (
        <h2 className={styles.routePreviewHeading}>
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      <p className={styles.routePreviewEmptyText}>
        <Inline text={emptyText} bundle={bundle} event={event} />
      </p>
    </div>
  );
};

function DisclaimerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5" />
      <path d="M12 18h.01" />
    </svg>
  );
}
