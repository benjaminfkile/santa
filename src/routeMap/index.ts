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
// screen. `setPin` stands the Santa pin (a MapLibre marker around the
// caller's element) on a point, eased over PIN_TRANSITION_MS when asked
// to animate and placed at once otherwise; null removes it. `terrain`
// adds the hillshade over the terrain archive to the style, through the
// same diff, so an appearance switch keeps it. `refit` resizes the map to
// its container and fits the path again (the fullscreen edges call it).
// `timeLabels` hands the style's time label layers their dots and ready
// made labels; a new set rebuilds the style through the same diff.
// `poiKinds` and `landmarks` reach the style's options of the same names
// only when given, and a changed list rebuilds the style the same way.
// `arrows`, `arrowScale`, and `routeWidthScale` reach the style's options
// of the same names; a change rebuilds the style the same way. The
// arrowhead image is added under ROUTE_ARROW_ICON whenever the style asks
// for it. `landmarkMarkers` stands one MapLibre marker around each
// caller's element on its point (the badges and buttons of the landmarks
// with an icon or a description); a changed list replaces them. The map
// takes gestures directly: the scroll wheel zooms and one finger pans.
// `probeTerrain` reads the header of `<base>/terrain.pmtiles` once per
// page load and resolves whether the archive exists; a missing or failing
// archive logs once and resolves false.

import "./maplibre.css";
import { Map as MapLibreMap, Marker, addProtocol, setWorkerUrl } from "maplibre-gl";
import type { AddProtocolAction } from "maplibre-gl";
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
  type Landmark,
  type LatLng,
  type StyleOptions,
  type TimeLabel,
} from "./style";

export type { Appearance } from "./flavors";
export type { Landmark, LatLng, TimeLabel } from "./style";

export type LandmarkMarker = { lat: number; lng: number; element: HTMLElement };

export type RouteMapOptions = {
  container: HTMLElement;
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  appearance: Appearance;
  terrain?: boolean;
  timeLabels?: readonly TimeLabel[];
  poiKinds?: readonly string[];
  landmarks?: readonly Landmark[];
  landmarkMarkers?: readonly LandmarkMarker[];
  arrows?: boolean;
  arrowScale?: number;
  routeWidthScale?: number;
  pinElement?: HTMLElement;
  onError: (error: unknown) => void;
};

export type RouteMapUpdate = {
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  appearance: Appearance;
  terrain?: boolean;
  timeLabels?: readonly TimeLabel[];
  poiKinds?: readonly string[];
  landmarks?: readonly Landmark[];
  landmarkMarkers?: readonly LandmarkMarker[];
  arrows?: boolean;
  arrowScale?: number;
  routeWidthScale?: number;
};

export type RouteMapHandle = {
  update: (next: RouteMapUpdate) => void;
  refit: () => void;
  setPin: (point: LatLng | null, animate: boolean) => void;
  destroy: () => void;
};

const FIT_PADDING = 40;

export const PIN_TRANSITION_MS = 300;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

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

function sameLandmarks(
  a: readonly Landmark[] | undefined,
  b: readonly Landmark[] | undefined,
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return sameLabels(a, b) && a.every((landmark, i) => landmark.badge === b[i].badge);
}

function sameMarkers(a: readonly LandmarkMarker[], b: readonly LandmarkMarker[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every(
    (m, i) => m.element === b[i].element && m.lat === b[i].lat && m.lng === b[i].lng,
  );
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
  let landmarks = options.landmarks;
  let arrows = options.arrows ?? false;
  let arrowScale = options.arrowScale;
  let routeWidthScale = options.routeWidthScale;

  function styleOptions(): StyleOptions {
    return {
      timeLabels,
      ...(poiKinds !== undefined ? { poiKinds } : {}),
      ...(landmarks !== undefined ? { landmarks } : {}),
      ...(arrows ? { arrows } : {}),
      ...(arrowScale !== undefined ? { arrowScale } : {}),
      ...(routeWidthScale !== undefined ? { routeWidthScale } : {}),
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

  let pin: Marker | null = null;
  let pinAt: LatLng | null = null;
  let frame: number | null = null;

  function stopEasing(): void {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  function placePin(point: LatLng): void {
    pinAt = point;
    pin?.setLngLat([point.lng, point.lat]);
  }

  let landmarkMarkers: readonly LandmarkMarker[] = [];
  let landmarkPins: Marker[] = [];

  function placeLandmarkMarkers(next: readonly LandmarkMarker[]): void {
    if (sameMarkers(landmarkMarkers, next)) return;
    for (const marker of landmarkPins) marker.remove();
    landmarkMarkers = next;
    landmarkPins = next.map(({ lat, lng, element }) =>
      new Marker({ element, anchor: "center" }).setLngLat([lng, lat]).addTo(map),
    );
  }

  placeLandmarkMarkers(options.landmarkMarkers ?? []);

  return {
    update(next) {
      placeLandmarkMarkers(next.landmarkMarkers ?? []);
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
        sameLandmarks(landmarks, next.landmarks) &&
        next.appearance === appearance &&
        nextTerrain === terrain &&
        nextArrows === arrows &&
        next.arrowScale === arrowScale &&
        next.routeWidthScale === routeWidthScale
      ) {
        return;
      }
      path = next.path;
      marks = nextMarks;
      appearance = next.appearance;
      terrain = nextTerrain;
      timeLabels = nextLabels;
      poiKinds = next.poiKinds;
      landmarks = next.landmarks;
      arrows = nextArrows;
      arrowScale = next.arrowScale;
      routeWidthScale = next.routeWidthScale;
      map.setStyle(buildStyle(appearance, base, path, marks, terrain, styleOptions()), {
        diff: true,
      });
      if (pathChanged) fit();
    },
    refit,
    setPin(point, animate) {
      stopEasing();
      if (point === null) {
        pin?.remove();
        pin = null;
        pinAt = null;
        return;
      }
      if (pin === null) {
        pin = new Marker({ element: options.pinElement, anchor: "center" })
          .setLngLat([point.lng, point.lat])
          .addTo(map);
        pinAt = point;
        return;
      }
      const from = pinAt;
      if (!animate || from === null || typeof requestAnimationFrame !== "function") {
        placePin(point);
        return;
      }
      let start: number | null = null;
      const step = (now: number): void => {
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / PIN_TRANSITION_MS);
        const k = easeOutCubic(t);
        placePin({
          lat: from.lat + (point.lat - from.lat) * k,
          lng: from.lng + (point.lng - from.lng) * k,
        });
        frame = t < 1 ? requestAnimationFrame(step) : null;
      };
      frame = requestAnimationFrame(step);
    },
    destroy() {
      stopEasing();
      pin?.remove();
      pin = null;
      for (const marker of landmarkPins) marker.remove();
      landmarkPins = [];
      observer?.disconnect();
      observer = null;
      map.remove();
    },
  };
}
