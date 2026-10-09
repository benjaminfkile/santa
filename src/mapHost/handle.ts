// docs/site.md sections 8.9 and 8.10. The map handle of route mode:
// MapLibre over the event's map (`snapshot.event.trackerMap`) in the
// theme's style (themeStyle.ts), the place filter on the theme's marked
// layers (places.ts), and the route overlay (routeLayers.ts) above the
// theme's last layer. MapLibre's worker is the bundled one and the
// `pmtiles://` protocol is registered once per page. The event box
// (`trackerBbox`) is the pan limit and sets the least zoom to the zoom
// that fits it, never under the map row's `minZoom`; the row's `maxZoom`
// is the most. A style, glyph, or tile error before the first complete
// render reports through `onError`; later errors (a tile dropped while
// panning) do not. The path is fitted with padding on mount and on every
// container resize, its bounds clamped to the box only where they leave
// it. `update` swaps the style as a diff: a new theme of the same shape
// changes paint properties only, so the basemap tiles stay on screen.
// `terrain` keeps the theme's terrain layers in the style and false takes
// them out, through the same diff, so a theme switch keeps it.
// `startElement` stands a MapLibre marker around the caller's element,
// anchored at its bottom centre, on the path's first point; a changed
// path moves the marker. `refit` resizes the map to its container and
// fits the path again (the fullscreen edges call it).
// `timeLabels`, `viewpoints`, `arrows`, `arrowScale`, `routeWidthScale`,
// `labelScale`, and `labelMinZoom` reach routeLayers' options of the same
// names and `poiKinds` the place filter; a change rebuilds the style
// through the same diff. The arrowhead image is added under
// ROUTE_ARROW_ICON whenever the style asks for it. `viewpointMarkers`
// stands one MapLibre marker around each caller's element on its point
// (the badges and buttons of the viewpoints with an icon or a
// description); a changed list replaces them. The map takes gestures
// directly: the scroll wheel zooms and one finger pans. Below
// `labelMinZoom` the names count as hidden. The handle listens on the
// viewpoint and time label dot layers by id, so the listeners outlive
// every style diff: while the names are hidden, a pointer entering a dot
// shows a Popup (TIP_CLASS, no close button) with the feature's `label`
// at the feature and the pointer cursor, gone when the pointer leaves,
// and a click on a time dot shows the same popup for TIP_PEEK_MS (a tap
// on a touch screen). A click on a viewpoint dot calls `onViewpointClick`
// with the feature's point at any zoom. The container carries
// `data-names` ("hidden" or "shown") from the mount and on every zoom
// event, so the caller's marker styles can follow it.

import "./maplibre.css";
import { Map as MapLibreMap, Marker, Popup, addProtocol, setWorkerUrl } from "maplibre-gl";
import type { AddProtocolAction, MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Bbox } from "../map/bounds";
import { applyPlaces } from "./places";
import {
  makeRouteArrowImage,
  pathBounds,
  routeLayers,
  ROUTE_ARROW_ICON,
  TIME_LABEL_DOTS_LAYER,
  VIEWPOINT_DOTS_LAYER,
  type LatLng,
  type OverlayPalette,
  type TimeLabel,
  type Viewpoint,
} from "./routeLayers";
import { mapBounds, themeStyle, withoutTerrain, type TrackerMap } from "./themeStyle";

export type { LatLng, TimeLabel, Viewpoint } from "./routeLayers";
export type { TrackerMap } from "./themeStyle";

export type ViewpointMarker = { lat: number; lng: number; element: HTMLElement };

// A theme as the handle draws it: its fetched style body, its sprite, and
// the palettes the overlay paints with.
export type HostTheme = OverlayPalette & {
  key: string;
  spriteUrl: string | null;
  style: StyleSpecification;
};

export type RouteMapUpdate = {
  theme: HostTheme;
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  terrain?: boolean;
  timeLabels?: readonly TimeLabel[];
  poiKinds?: readonly string[] | null;
  viewpoints?: readonly Viewpoint[];
  viewpointMarkers?: readonly ViewpointMarker[];
  arrows?: boolean;
  arrowScale?: number;
  routeWidthScale?: number;
  labelScale?: number;
  labelMinZoom?: number;
};

export type RouteMapOptions = RouteMapUpdate & {
  container: HTMLElement;
  trackerMap: TrackerMap;
  bbox: Bbox | null;
  startElement?: HTMLElement;
  onViewpointClick?: (point: { lat: number; lng: number }) => void;
  onError: (error: unknown) => void;
};

export type RouteMapHandle = {
  update: (next: RouteMapUpdate) => void;
  refit: () => void;
  destroy: () => void;
};

const FIT_PADDING = 40;
// The class of the dot tooltip popup (maplibre.css).
export const TIP_CLASS = "route-map-tip";
// How long a tapped time dot shows its label.
export const TIP_PEEK_MS = 2500;

export const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

let protocolAdded = false;

function ensureProtocol(): void {
  if (protocolAdded) return;
  protocolAdded = true;
  setWorkerUrl(workerUrl);
  const protocol = new Protocol();
  addProtocol("pmtiles", protocol.tile as AddProtocolAction);
}

function samePath(a: readonly LatLng[], b: readonly LatLng[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].lat !== b[i].lat || a[i].lng !== b[i].lng) return false;
  }
  return true;
}

function sameLabels(a: readonly TimeLabel[], b: readonly TimeLabel[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].lat !== b[i].lat || a[i].lng !== b[i].lng || a[i].label !== b[i].label) return false;
  }
  return true;
}

function sameKinds(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  if (a === b) return true;
  if (a === undefined || a === null || b === undefined || b === null || a.length !== b.length) {
    return false;
  }
  return a.every((kind, i) => kind === b[i]);
}

function sameViewpoints(
  a: readonly Viewpoint[] | undefined,
  b: readonly Viewpoint[] | undefined,
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return sameLabels(a, b) && a.every((viewpoint, i) => viewpoint.badge === b[i].badge);
}

function sameMarkers(a: readonly ViewpointMarker[], b: readonly ViewpointMarker[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every(
    (m, i) => m.element === b[i].element && m.lat === b[i].lat && m.lng === b[i].lng,
  );
}

// The point of the event's first feature when it is a point.
function featurePoint(event: MapLayerMouseEvent): LatLng | null {
  const geometry = event.features?.[0]?.geometry;
  if (geometry?.type !== "Point") return null;
  const [lng, lat] = geometry.coordinates;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

function stateOf(next: RouteMapUpdate) {
  return {
    theme: next.theme,
    path: next.path,
    marks: next.marks ?? [],
    terrain: next.terrain ?? false,
    timeLabels: next.timeLabels ?? [],
    poiKinds: next.poiKinds,
    viewpoints: next.viewpoints,
    viewpointMarkers: next.viewpointMarkers ?? [],
    arrows: next.arrows ?? false,
    arrowScale: next.arrowScale,
    routeWidthScale: next.routeWidthScale,
    labelScale: next.labelScale,
    labelMinZoom: next.labelMinZoom,
  };
}

type State = ReturnType<typeof stateOf>;

function sameTheme(a: HostTheme, b: HostTheme): boolean {
  return (
    a.key === b.key &&
    a.style === b.style &&
    a.spriteUrl === b.spriteUrl &&
    JSON.stringify(a.overlay) === JSON.stringify(b.overlay) &&
    JSON.stringify(a.chrome) === JSON.stringify(b.chrome)
  );
}

function sameState(a: State, b: State): boolean {
  return (
    sameTheme(a.theme, b.theme) &&
    samePath(a.path, b.path) &&
    samePath(a.marks, b.marks) &&
    sameLabels(a.timeLabels, b.timeLabels) &&
    sameKinds(a.poiKinds, b.poiKinds) &&
    sameViewpoints(a.viewpoints, b.viewpoints) &&
    a.terrain === b.terrain &&
    a.arrows === b.arrows &&
    a.arrowScale === b.arrowScale &&
    a.routeWidthScale === b.routeWidthScale &&
    a.labelScale === b.labelScale &&
    a.labelMinZoom === b.labelMinZoom
  );
}

export function mountRouteMap(options: RouteMapOptions): RouteMapHandle {
  const { container, onError, trackerMap, bbox } = options;
  if (trackerMap.tilesUrl === "") throw new Error("The event's map has no tiles");
  ensureProtocol();
  let state = stateOf(options);
  const startElement = options.startElement;

  // The theme's style for the event's map, kept per theme body.
  let based: { theme: HostTheme; style: StyleSpecification } | null = null;
  function baseStyle(theme: HostTheme): StyleSpecification {
    if (based === null || based.theme.style !== theme.style || based.theme.spriteUrl !== theme.spriteUrl) {
      based = { theme, style: themeStyle(theme.style, trackerMap, theme.spriteUrl) };
    }
    return based.style;
  }

  function buildStyle(): StyleSpecification {
    const base = applyPlaces(baseStyle(state.theme), state.poiKinds);
    const style = state.terrain ? base : withoutTerrain(base);
    const overlay = routeLayers(state.theme, state.path, state.marks, {
      timeLabels: state.timeLabels,
      ...(state.viewpoints !== undefined ? { viewpoints: state.viewpoints } : {}),
      ...(state.arrows ? { arrows: true } : {}),
      ...(state.arrowScale !== undefined ? { arrowScale: state.arrowScale } : {}),
      ...(state.routeWidthScale !== undefined ? { routeWidthScale: state.routeWidthScale } : {}),
      ...(state.labelScale !== undefined ? { labelScale: state.labelScale } : {}),
      ...(state.labelMinZoom !== undefined ? { labelMinZoom: state.labelMinZoom } : {}),
    });
    return {
      ...style,
      sources: { ...style.sources, ...overlay.sources },
      layers: [...style.layers, ...overlay.layers],
    };
  }

  function padding(): number {
    const { clientWidth, clientHeight } = container;
    return Math.max(0, Math.min(FIT_PADDING, Math.floor(Math.min(clientWidth, clientHeight) / 4)));
  }

  function viewport() {
    return { width: container.clientWidth, height: container.clientHeight };
  }

  // The path's bounds, clamped to the event box where they leave it.
  function fitBounds(): [[number, number], [number, number]] | null {
    const bounds = pathBounds(state.path);
    if (bounds === null || bbox === null) return bounds;
    const [[west, south], [east, north]] = bounds;
    if (west >= bbox.west && south >= bbox.south && east <= bbox.east && north <= bbox.north) {
      return bounds;
    }
    const lng = (v: number) => Math.min(bbox.east, Math.max(bbox.west, v));
    const lat = (v: number) => Math.min(bbox.north, Math.max(bbox.south, v));
    return [[lng(west), lat(south)], [lng(east), lat(north)]];
  }

  const limits = mapBounds(bbox, viewport(), trackerMap);
  const map = new MapLibreMap({
    container,
    style: buildStyle(),
    bounds: fitBounds() ?? undefined,
    fitBoundsOptions: { padding: padding() },
    ...limits,
    attributionControl: { compact: false, customAttribution: OSM_ATTRIBUTION },
    boxZoom: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    trackResize: false,
  });

  function fit(): void {
    const bounds = fitBounds();
    if (bounds === null) return;
    map.fitBounds(bounds, { padding: padding(), animate: false });
  }

  let settled = false;
  let failed = false;
  map.once("idle", () => {
    settled = true;
  });
  map.on("styleimagemissing", (event) => {
    if (event.id !== ROUTE_ARROW_ICON || map.hasImage(ROUTE_ARROW_ICON)) return;
    const image = makeRouteArrowImage();
    map.addImage(ROUTE_ARROW_ICON, image.data, image.options);
  });
  map.on("error", (event) => {
    if (settled || failed) return;
    failed = true;
    onError(event.error);
  });

  function refit(): void {
    map.resize();
    if (bbox !== null) {
      const minZoom = mapBounds(bbox, viewport(), trackerMap).minZoom;
      if (minZoom !== undefined) map.setMinZoom(minZoom);
    }
    fit();
  }

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(refit);
    observer.observe(container);
  }

  const start: Marker | null =
    startElement === undefined || state.path.length === 0
      ? null
      : new Marker({ element: startElement, anchor: "bottom" })
          .setLngLat([state.path[0].lng, state.path[0].lat])
          .addTo(map);

  let viewpointMarkers: readonly ViewpointMarker[] = [];
  let viewpointPins: Marker[] = [];

  function placeViewpointMarkers(next: readonly ViewpointMarker[]): void {
    if (sameMarkers(viewpointMarkers, next)) return;
    for (const marker of viewpointPins) marker.remove();
    viewpointMarkers = next;
    viewpointPins = next.map(({ lat, lng, element }) =>
      new Marker({ element, anchor: "center" }).setLngLat([lng, lat]).addTo(map),
    );
  }

  placeViewpointMarkers(state.viewpointMarkers);

  function namesHidden(): boolean {
    return state.labelMinZoom !== undefined && map.getZoom() < state.labelMinZoom;
  }

  function stampNames(): void {
    container.setAttribute("data-names", namesHidden() ? "hidden" : "shown");
  }

  let tip: Popup | null = null;
  let tipTimer: ReturnType<typeof setTimeout> | null = null;

  function hideTip(): void {
    if (tipTimer !== null) clearTimeout(tipTimer);
    tipTimer = null;
    tip?.remove();
    tip = null;
  }

  // Shows the tooltip popup with the event's first feature's label at
  // that feature's point; returns false when the feature has none.
  function showTip(event: MapLayerMouseEvent): boolean {
    const feature = event.features?.[0];
    const label: unknown = feature?.properties?.label;
    const point = featurePoint(event);
    if (typeof label !== "string" || point === null) return false;
    hideTip();
    tip = new Popup({ closeButton: false, closeOnClick: false, offset: 10, className: TIP_CLASS })
      .setLngLat([point.lng, point.lat])
      .setText(label)
      .addTo(map);
    return true;
  }

  function setCursor(cursor: string): void {
    map.getCanvas().style.cursor = cursor;
  }

  map.on("zoom", stampNames);
  stampNames();

  map.on("mouseenter", VIEWPOINT_DOTS_LAYER, (event) => {
    setCursor("pointer");
    if (namesHidden()) showTip(event);
  });
  map.on("mouseleave", VIEWPOINT_DOTS_LAYER, () => {
    setCursor("");
    hideTip();
  });
  map.on("click", VIEWPOINT_DOTS_LAYER, (event) => {
    const point = featurePoint(event);
    if (point !== null) options.onViewpointClick?.(point);
  });
  map.on("mouseenter", TIME_LABEL_DOTS_LAYER, (event) => {
    if (!namesHidden()) return;
    setCursor("pointer");
    showTip(event);
  });
  map.on("mouseleave", TIME_LABEL_DOTS_LAYER, () => {
    setCursor("");
    hideTip();
  });
  map.on("click", TIME_LABEL_DOTS_LAYER, (event) => {
    if (!namesHidden() || !showTip(event)) return;
    tipTimer = setTimeout(hideTip, TIP_PEEK_MS);
  });

  return {
    update(update) {
      const next = stateOf(update);
      placeViewpointMarkers(next.viewpointMarkers);
      if (sameState(state, next)) return;
      const pathChanged = !samePath(state.path, next.path);
      state = next;
      stampNames();
      map.setStyle(buildStyle(), { diff: true });
      if (pathChanged) {
        if (state.path.length > 0) start?.setLngLat([state.path[0].lng, state.path[0].lat]);
        fit();
      }
    },
    refit,
    destroy() {
      hideTip();
      start?.remove();
      for (const marker of viewpointPins) marker.remove();
      viewpointPins = [];
      observer?.disconnect();
      observer = null;
      map.remove();
    },
  };
}
