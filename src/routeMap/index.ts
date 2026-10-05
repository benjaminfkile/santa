// docs/site.md section 8.9. The route map: MapLibre over the CDN basemap
// (VITE_ROUTE_BASEMAP_URL), in its own `routemap` chunk with its React
// host (RouteMap.tsx), which the `map` style of `route_preview` imports
// when it mounts. The pmtiles archive header is read first, so an
// unreachable archive rejects the mount before a map exists, and its zoom
// range bounds the map. A style, glyph, or tile error before the first
// complete render reports through `onError`; later errors (a tile dropped
// while panning) do not. The path is fitted with padding on mount and on
// every container resize. `update` swaps the style as a diff: a new
// appearance changes paint properties only, so the basemap tiles stay on
// screen. `startElement` stands a MapLibre marker around the caller's
// element, anchored at its bottom centre, on the path's first point, and
// the style then leaves its start circle out; a changed path moves the
// marker. `terrain`
// adds the hillshade over the terrain archive to the style, through the
// same diff, so an appearance switch keeps it. `refit` resizes the map to
// its container and fits the path again (the fullscreen edges call it).
// `timeLabels` hands the style's time label layers their dots and ready
// made labels; a new set rebuilds the style through the same diff.
// `poiKinds` and `viewpoints` reach the style's options of the same names
// only when given, and a changed list rebuilds the style the same way.
// `arrows`, `arrowScale`, `routeWidthScale`, and `labelScale` reach the
// style's options of the same names; a change rebuilds the style the
// same way. The arrowhead image is added under ROUTE_ARROW_ICON whenever the style asks
// for it. `viewpointMarkers` stands one MapLibre marker around each
// caller's element on its point (the badges and buttons of the viewpoints
// with an icon or a description); a changed list replaces them. The map
// takes gestures directly: the scroll wheel zooms and one finger pans.
// `labelMinZoom` reaches the style's option of the same name (the two
// text layers start at it) and a change rebuilds the style the same way;
// below it the names count as hidden. The handle listens on the viewpoint
// and time label dot layers by id, so the listeners outlive every style
// diff: while the names are hidden, a pointer entering a dot shows a
// Popup (TIP_CLASS, no close button) with the feature's `label` at the
// feature and the pointer cursor, gone when the pointer leaves, and a
// click on a time dot shows the same popup for TIP_PEEK_MS (a tap on a
// touch screen). A click on a viewpoint dot calls `onViewpointClick` with
// the feature's point at any zoom. The container carries `data-names`
// ("hidden" or "shown") from the mount and on every zoom event, so the
// caller's marker styles can follow it.
// `probeTerrain` reads the header of `<base>/terrain.pmtiles` once per
// page load and resolves whether the archive exists; a missing or failing
// archive logs once and resolves false.

import "./maplibre.css";
import { Map as MapLibreMap, Marker, Popup, addProtocol, setWorkerUrl } from "maplibre-gl";
import type { AddProtocolAction, MapLayerMouseEvent } from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { env } from "../config/env";
import type { Appearance } from "./flavors";
import {
  OSM_ATTRIBUTION,
  buildStyle,
  makeRouteArrowImage,
  pathBounds,
  terrainUrl,
  ROUTE_ARROW_ICON,
  tilesUrl,
  VIEWPOINT_DOTS_LAYER,
  TIME_LABEL_DOTS_LAYER,
  type Viewpoint,
  type LatLng,
  type StyleOptions,
  type TimeLabel,
} from "./style";

export type { Appearance } from "./flavors";
export type { Viewpoint, LatLng, TimeLabel } from "./style";

export type ViewpointMarker = { lat: number; lng: number; element: HTMLElement };

export type RouteMapOptions = {
  container: HTMLElement;
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  appearance: Appearance;
  terrain?: boolean;
  timeLabels?: readonly TimeLabel[];
  poiKinds?: readonly string[];
  viewpoints?: readonly Viewpoint[];
  viewpointMarkers?: readonly ViewpointMarker[];
  arrows?: boolean;
  arrowScale?: number;
  routeWidthScale?: number;
  labelScale?: number;
  labelMinZoom?: number;
  startElement?: HTMLElement;
  onViewpointClick?: (point: { lat: number; lng: number }) => void;
  onError: (error: unknown) => void;
};

export type RouteMapUpdate = {
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  appearance: Appearance;
  terrain?: boolean;
  timeLabels?: readonly TimeLabel[];
  poiKinds?: readonly string[];
  viewpoints?: readonly Viewpoint[];
  viewpointMarkers?: readonly ViewpointMarker[];
  arrows?: boolean;
  arrowScale?: number;
  routeWidthScale?: number;
  labelScale?: number;
  labelMinZoom?: number;
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

let protocol: Protocol | null = null;

function ensureProtocol(): Protocol {
  if (protocol === null) {
    setWorkerUrl(workerUrl);
    protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile as AddProtocolAction);
  }
  return protocol;
}

function archiveAt(url: string): PMTiles {
  const proto = ensureProtocol();
  let archive = proto.get(url);
  if (archive === undefined) {
    archive = new PMTiles(url);
    proto.add(archive);
  }
  return archive;
}

let terrainProbe: Promise<boolean> | null = null;

export function probeTerrain(): Promise<boolean> {
  if (terrainProbe === null) {
    const base = env.ROUTE_BASEMAP_URL;
    terrainProbe = (async () => {
      if (base === "") return false;
      await archiveAt(terrainUrl(base)).getHeader();
      return true;
    })().catch((error: unknown) => {
      console.warn("route map: no terrain archive, the terrain view is off", error);
      return false;
    });
  }
  return terrainProbe;
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

function sameKinds(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a.length !== b.length) return false;
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

export async function mountRouteMap(options: RouteMapOptions): Promise<RouteMapHandle> {
  const base = env.ROUTE_BASEMAP_URL;
  if (base === "") throw new Error("VITE_ROUTE_BASEMAP_URL is not set");
  const { container, onError } = options;
  let path = options.path;
  let marks = options.marks ?? [];
  let appearance = options.appearance;
  let terrain = options.terrain ?? false;
  let timeLabels = options.timeLabels ?? [];
  let poiKinds = options.poiKinds;
  let viewpoints = options.viewpoints;
  let arrows = options.arrows ?? false;
  let arrowScale = options.arrowScale;
  let routeWidthScale = options.routeWidthScale;
  let labelScale = options.labelScale;
  let labelMinZoom = options.labelMinZoom;
  const startElement = options.startElement;

  function styleOptions(): StyleOptions {
    return {
      timeLabels,
      ...(startElement !== undefined ? { startCircle: false } : {}),
      ...(poiKinds !== undefined ? { poiKinds } : {}),
      ...(viewpoints !== undefined ? { viewpoints } : {}),
      ...(arrows ? { arrows } : {}),
      ...(arrowScale !== undefined ? { arrowScale } : {}),
      ...(routeWidthScale !== undefined ? { routeWidthScale } : {}),
      ...(labelScale !== undefined ? { labelScale } : {}),
      ...(labelMinZoom !== undefined ? { labelMinZoom } : {}),
    };
  }

  const header = await archiveAt(tilesUrl(base)).getHeader();

  function padding(): number {
    const { clientWidth, clientHeight } = container;
    return Math.max(0, Math.min(FIT_PADDING, Math.floor(Math.min(clientWidth, clientHeight) / 4)));
  }

  const map = new MapLibreMap({
    container,
    style: buildStyle(appearance, base, path, marks, terrain, styleOptions()),
    bounds: pathBounds(path) ?? undefined,
    fitBoundsOptions: { padding: padding() },
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    attributionControl: { compact: false, customAttribution: OSM_ATTRIBUTION },
    boxZoom: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    trackResize: false,
  });

  function fit(): void {
    const bounds = pathBounds(path);
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
    fit();
  }

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(refit);
    observer.observe(container);
  }

  const start: Marker | null =
    startElement === undefined || path.length === 0
      ? null
      : new Marker({ element: startElement, anchor: "bottom" })
          .setLngLat([path[0].lng, path[0].lat])
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

  placeViewpointMarkers(options.viewpointMarkers ?? []);

  function namesHidden(): boolean {
    return labelMinZoom !== undefined && map.getZoom() < labelMinZoom;
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
    update(next) {
      placeViewpointMarkers(next.viewpointMarkers ?? []);
      const nextArrows = next.arrows ?? false;
      const nextMarks = next.marks ?? [];
      const pathChanged = !samePath(path, next.path);
      const marksChanged = !samePath(marks, nextMarks);
      const nextTerrain = next.terrain ?? false;
      const nextLabels = next.timeLabels ?? [];
      if (
        !pathChanged &&
        !marksChanged &&
        sameLabels(timeLabels, nextLabels) &&
        sameKinds(poiKinds, next.poiKinds) &&
        sameViewpoints(viewpoints, next.viewpoints) &&
        next.appearance === appearance &&
        nextTerrain === terrain &&
        nextArrows === arrows &&
        next.arrowScale === arrowScale &&
        next.routeWidthScale === routeWidthScale &&
        next.labelScale === labelScale &&
        next.labelMinZoom === labelMinZoom
      ) {
        return;
      }
      path = next.path;
      marks = nextMarks;
      appearance = next.appearance;
      terrain = nextTerrain;
      timeLabels = nextLabels;
      poiKinds = next.poiKinds;
      viewpoints = next.viewpoints;
      arrows = nextArrows;
      arrowScale = next.arrowScale;
      routeWidthScale = next.routeWidthScale;
      labelScale = next.labelScale;
      labelMinZoom = next.labelMinZoom;
      stampNames();
      map.setStyle(buildStyle(appearance, base, path, marks, terrain, styleOptions()), {
        diff: true,
      });
      if (pathChanged) {
        if (path.length > 0) start?.setLngLat([path[0].lng, path[0].lat]);
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
