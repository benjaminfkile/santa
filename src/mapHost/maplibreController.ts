// docs/site.md sections 8.3 and 8.10 (Live mode). The `MapController` of
// the live tracker over a MapLibre map, behind the same interface as the
// Google controller (src/map/mapController.ts), so the section, the menu,
// and the overlays never know the renderer.
// The style is the viewer's theme body (themeStyle.ts) over the event's
// map, the place filter on the theme's marked layers (places.ts, the
// tracker's kinds expanded to Protomaps kinds, the theme's own places
// while the filter is null), the theme's terrain layers in for `terrain`
// and out for `roadmap` (default terrain), and above it the flight
// history and the dotted line to the viewer (routeLayers.ts). Every change
// is applied with `setStyle` and `diff: true`; the flight history redraws
// on the zoom, debounced ZOOM_REDRAW_MS, with the step and interval tables
// of 8.5. `setTheme` awaits the theme's body; a later call wins over an
// earlier one still waiting, and the colour scheme never changes it.
// The Santa pin is an HTML marker holding the same image as on Google,
// its tip on the fix, hidden while waiting for a fix and filtered while
// the signal is lost (8.7); the viewpoints are HTML markers holding the
// same badges and popover (viewpointsOverlay.ts), rebuilt only when the
// list says something new; the viewer's location is an HTML marker and a
// dotted line (userLocation.ts).
// The map is locked to the event box: `maxBounds` and the least zoom that
// fits it (recomputed when the container resizes), and every pan the
// controller makes clamped to it. A fix outside the box draws Santa on its
// edge and pans there; a flight history point outside it is drawn but left
// out of `fitHistory`. The first view fits the box when there is no fix,
// centres on the fix at the default zoom when it is inside the box, and
// takes the default centre and zoom when the fix lies outside it.
// A style error before the first `idle`, or a lost WebGL context that is
// not restored within 5 s, reports through `onFail` once. `destroy` removes
// the map, its markers, and every timer; every method is a no-op after it.

import { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl";
import type { MapController, MapControllerOptions } from "../map/mapController";
import type { MapTheme, ThemeStyle } from "../map/themes";
import type { PoiFilter } from "../map/poiStyles";
import type { HistoryPoint } from "../map/flightHistoryOverlay";
import {
  arrowScaleForZoom,
  arrowStepForZoom,
  labelIntervalMinutesForZoom,
  pickLabelPoints,
} from "../map/flightHistoryOverlay";
import {
  createViewpointBadges,
  VIEWPOINTS_MIN_ZOOM,
  type TrackerViewpoint,
  type ViewpointBadges,
} from "../map/viewpointsOverlay";
import { createSantaPinImage } from "../map/santaPin";
import { SANTA_MARKER_HEIGHT, SIGNAL_LOST_FILTER } from "../map/santaMarker";
import { clampToBbox, inBox, type LatLng } from "../map/bounds";
import { ensureProtocol, OSM_ATTRIBUTION, watchContext, type MapLibreFailure } from "./handle";
import { applyPlaces, protomapsKinds } from "./places";
import {
  flightHistoryLayers,
  makeRouteArrowImage,
  pathBounds,
  ROUTE_ARROW_ICON,
  userLineLayers,
  type FlightHistoryArrow,
  type RouteLayers,
} from "./routeLayers";
import { mapBounds, themeStyle, withoutTerrain, type TrackerMap } from "./themeStyle";
import { createMapLibreUserLocation, type MapLibreUserLocation } from "./userLocation";

export type MaplibreControllerOptions = MapControllerOptions & {
  trackerMap: TrackerMap;
  // The fix in hand when the map is built, which picks the first view.
  fix: LatLng | null;
  onFail: (reason: MapLibreFailure, error: unknown) => void;
};

export const ZOOM_REDRAW_MS = 150;
const FIT_PADDING = 40;

export function isMapLibreStyle(body: unknown): body is StyleSpecification {
  return (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Array.isArray((body as { layers?: unknown }).layers) &&
    typeof (body as { sources?: unknown }).sources === "object"
  );
}

function styleOf(theme: MapTheme, body: ThemeStyle): StyleSpecification {
  if (!isMapLibreStyle(body)) throw new Error(`The theme ${theme.key} has no MapLibre style`);
  return body;
}

// Degrees clockwise from north, from `a` towards `b`.
function bearing(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

// What the overlay draws from a viewpoint; two lists with the same
// signature draw the same badges.
function viewpointsSignature(list: readonly TrackerViewpoint[]): string {
  return JSON.stringify(
    list.map((l) => [l.lat, l.lng, l.name, l.icon ?? null, l.description ?? null]),
  );
}

export function createMaplibreController(
  container: HTMLElement,
  opts: MaplibreControllerOptions,
): MapController {
  ensureProtocol();
  const { trackerMap, bbox } = opts;
  let theme = opts.theme;
  let body = styleOf(theme, opts.style);
  let pois: PoiFilter = null;
  let terrain = true;
  let points: HistoryPoint[] | null = null;
  let toggles = { flightHistory: false, timeLabels: true, landmarks: true };
  let following = true;
  let disposed = false;
  let failed = false;
  let themeRequest = 0;
  let zoomTimer: ReturnType<typeof setTimeout> | null = null;
  // The flight history tables last drawn, so a zoom that keeps them
  // changes nothing.
  let drawnTables = "";

  function clamp(p: LatLng): LatLng {
    return bbox === null ? p : clampToBbox(p, bbox);
  }

  function viewport() {
    return { width: container.clientWidth, height: container.clientHeight };
  }

  function zoom(): number {
    return map.getZoom();
  }

  function historyLayers(z: number): RouteLayers | null {
    if (!toggles.flightHistory || points === null) return null;
    const path = points.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
    if (path.length < 2) return null;
    const step = arrowStepForZoom(z);
    const arrows: FlightHistoryArrow[] = [];
    for (let i = step; i < path.length; i += step) {
      arrows.push({ lat: path[i].lat, lng: path[i].lng, bearing: bearing(path[i - 1], path[i]) });
    }
    const labels = toggles.timeLabels
      ? pickLabelPoints(path, labelIntervalMinutesForZoom(z)).map((l) => ({
          lat: l.lat,
          lng: l.lng,
          label: l.labelText,
        }))
      : [];
    return flightHistoryLayers(theme, path, arrows, labels, arrowScaleForZoom(z) / 2);
  }

  function tablesAt(z: number): string {
    return `${arrowStepForZoom(z)}/${labelIntervalMinutesForZoom(z)}/${arrowScaleForZoom(z)}`;
  }

  function buildStyle(z: number): StyleSpecification {
    let style = themeStyle(body, trackerMap, theme.spriteUrl);
    if (pois !== null) style = applyPlaces(style, protomapsKinds(pois.kinds));
    if (!terrain) style = withoutTerrain(style);
    const extra: RouteLayers[] = [];
    const history = historyLayers(z);
    if (history !== null) extra.push(history);
    const line = userLoc?.line() ?? null;
    if (line !== null) extra.push(userLineLayers(theme, line[0], line[1]));
    drawnTables = tablesAt(z);
    return {
      ...style,
      sources: Object.assign({}, style.sources, ...extra.map((e) => e.sources)),
      layers: [...style.layers, ...extra.flatMap((e) => e.layers)],
    };
  }

  function restyle(): void {
    if (disposed) return;
    map.setStyle(buildStyle(zoom()), { diff: true });
  }

  // The first view: the box fitted without a fix, the fix at the default
  // zoom when the box holds it, the default centre otherwise.
  function initialView(): { bounds: LngLatBoundsLike } | { center: [number, number]; zoom: number } {
    const fix = opts.fix;
    if (fix === null) {
      if (bbox !== null) return { bounds: [[bbox.west, bbox.south], [bbox.east, bbox.north]] };
      return { center: [opts.defaultCenter.lng, opts.defaultCenter.lat], zoom: opts.defaultZoom };
    }
    const at = bbox === null || inBox(fix, bbox) ? fix : clamp(opts.defaultCenter);
    return { center: [at.lng, at.lat], zoom: opts.defaultZoom };
  }

  let userLoc: MapLibreUserLocation | null = null;
  const map = new MapLibreMap({
    container,
    style: buildStyle(opts.defaultZoom),
    ...initialView(),
    ...mapBounds(bbox, viewport(), trackerMap),
    attributionControl: { compact: false, customAttribution: OSM_ATTRIBUTION },
    boxZoom: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    trackResize: false,
  });

  function fail(reason: MapLibreFailure, error: unknown): void {
    if (disposed || failed) return;
    failed = true;
    opts.onFail(reason, error);
  }

  let settled = false;
  map.once("idle", () => {
    settled = true;
  });
  map.on("error", (event) => {
    if (!settled) fail("style_failed", event.error);
  });
  const stopContextWatch = watchContext(map, (error) => fail("context_lost", error));
  map.on("styleimagemissing", (event) => {
    if (disposed || event.id !== ROUTE_ARROW_ICON || map.hasImage(ROUTE_ARROW_ICON)) return;
    const image = makeRouteArrowImage();
    map.addImage(ROUTE_ARROW_ICON, image.data, image.options);
  });

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      if (disposed) return;
      map.resize();
      const least = mapBounds(bbox, viewport(), trackerMap).minZoom;
      if (least !== undefined) map.setMinZoom(least);
    });
    observer.observe(container);
  }

  // The Santa pin, its tip (the image's bottom centre) on the fix.
  const pin = createSantaPinImage(SANTA_MARKER_HEIGHT);
  pin.setAttribute("data-testid", "santa-marker");
  const santa = opts.showSantaMarker ? new Marker({ element: pin, anchor: "bottom" }) : null;
  let santaShown = false;
  let santaAt: LatLng | null = null;

  // The viewpoint popover lives in the map view wrapper, whose box is the
  // canvas's box, so the map's container pixels are its pixels.
  const popoverHost = container.parentElement ?? container;
  let viewpointList: readonly TrackerViewpoint[] = [];
  let viewpointsKey = viewpointsSignature([]);
  let badges: ViewpointBadges | null = null;
  let viewpointMarkers: Marker[] = [];
  let viewpointsShown = false;

  function updateViewpoints(): void {
    if (badges === null) return;
    const z = zoom();
    badges.setNames(z);
    const next = toggles.landmarks && z >= VIEWPOINTS_MIN_ZOOM;
    if (next === viewpointsShown) return;
    viewpointsShown = next;
    if (!next) badges.close();
    for (const m of viewpointMarkers) {
      if (next) m.addTo(map);
      else m.remove();
    }
  }

  function clearViewpoints(): void {
    for (const m of viewpointMarkers) m.remove();
    viewpointMarkers = [];
    badges?.destroy();
    badges = null;
    viewpointsShown = false;
  }

  try {
    if (opts.showUserLocation) {
      userLoc = createMapLibreUserLocation(
        map,
        theme,
        (s) => {
          if (!disposed) opts.onUserLocationChange?.(s);
        },
        () => restyle(),
        bbox,
      );
    }
  } catch (err) {
    stopContextWatch();
    observer?.disconnect();
    map.remove();
    throw err;
  }

  map.on("dragstart", () => {
    if (disposed || !following) return;
    following = false;
    opts.onFollowChange?.(false);
  });
  map.on("move", () => {
    if (!disposed) badges?.position();
  });
  map.on("zoom", () => {
    if (disposed) return;
    updateViewpoints();
    if (zoomTimer !== null) clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => {
      zoomTimer = null;
      if (disposed || historyLayers(zoom()) === null || tablesAt(zoom()) === drawnTables) return;
      restyle();
    }, ZOOM_REDRAW_MS);
  });

  function panTo(p: LatLng): void {
    map.panTo([p.lng, p.lat], { animate: !reducedMotion() });
  }

  return {
    async setTheme(t) {
      if (disposed) return;
      const request = ++themeRequest;
      const next = styleOf(t, await t.getStyle());
      if (disposed || request !== themeRequest) return;
      theme = t;
      body = next;
      restyle();
      userLoc?.setTheme(t);
    },
    setPois(filter) {
      if (disposed) return;
      pois = filter;
      restyle();
    },
    setMapType(type) {
      if (disposed) return;
      const next = type === "terrain";
      if (next === terrain) return;
      terrain = next;
      restyle();
    },
    setFlightHistory(p) {
      if (disposed) return;
      points = p;
      restyle();
    },
    setViewpoints(list) {
      if (disposed) return;
      // Rebuilding drops an open popover and makes every badge blink, so a
      // list that says the same thing as the one on the map is a no-op.
      const key = viewpointsSignature(list);
      if (key === viewpointsKey) return;
      viewpointsKey = key;
      viewpointList = list;
      clearViewpoints();
      badges = createViewpointBadges(viewpointList, opts.mountIcon ?? null, popoverHost, (index) => {
        const v = viewpointList[index];
        const point = map.project([v.lng, v.lat]);
        return { x: point.x, y: point.y };
      });
      viewpointMarkers = badges.items.map(({ viewpoint, element }) =>
        new Marker({ element, anchor: "center" }).setLngLat([viewpoint.lng, viewpoint.lat]),
      );
      updateViewpoints();
    },
    setToggles(t) {
      if (disposed) return;
      toggles = {
        flightHistory: t.flightHistory ?? toggles.flightHistory,
        timeLabels: t.timeLabels ?? toggles.timeLabels,
        landmarks: t.landmarks ?? toggles.landmarks,
      };
      restyle();
      updateViewpoints();
    },
    setLiveFix(state, pos, seqChanged) {
      if (disposed) return;
      const shown = pos === null ? null : clamp(pos);
      if (santa !== null) {
        if (state === "waitingForFix") {
          santaAt = null;
          if (santaShown) santa.remove();
          santaShown = false;
        } else {
          const variant = state === "signalLost" ? "signalLost" : "tracking";
          pin.style.filter = variant === "signalLost" ? SIGNAL_LOST_FILTER : "";
          pin.setAttribute("data-variant", variant);
          if (shown !== null) santaAt = shown;
          if (santaAt !== null) {
            santa.setLngLat([santaAt.lng, santaAt.lat]);
            if (!santaShown) santa.addTo(map);
            santaShown = true;
          }
        }
      }
      userLoc?.setSanta(pos);
      if (following && seqChanged && shown !== null) panTo(shown);
    },
    follow(on) {
      if (disposed) return;
      following = on;
      opts.onFollowChange?.(on);
    },
    recenter(pos) {
      if (disposed) return;
      if (pos !== null) panTo(clamp(pos));
      following = true;
      opts.onFollowChange?.(true);
    },
    zoomBy(delta) {
      if (disposed) return;
      map.setZoom(zoom() + delta);
    },
    fitHistory() {
      if (disposed) return;
      const inside = (points ?? []).filter(
        (p) =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          (bbox === null || inBox(p, bbox)),
      );
      const bounds = pathBounds(inside);
      if (bounds === null) return;
      const { width, height } = viewport();
      const padding = Math.max(0, Math.min(FIT_PADDING, Math.floor(Math.min(width, height) / 4)));
      map.fitBounds(bounds, { padding, animate: !reducedMotion() });
    },
    enableUserLocation: () => (disposed ? Promise.resolve() : (userLoc?.enable() ?? Promise.resolve())),
    disableUserLocation: () => {
      if (!disposed) userLoc?.disable();
    },
    getUserLocation: () => (disposed ? null : (userLoc?.getState() ?? null)),
    destroy() {
      if (disposed) return;
      disposed = true;
      if (zoomTimer !== null) clearTimeout(zoomTimer);
      zoomTimer = null;
      stopContextWatch();
      observer?.disconnect();
      observer = null;
      clearViewpoints();
      santa?.remove();
      userLoc?.destroy();
      userLoc = null;
      map.remove();
    },
  };
}
