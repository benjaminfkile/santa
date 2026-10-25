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
// its tip on the displayed position, hidden while waiting for a fix and
// filtered while the signal is lost (8.7). Every fix with a new seq goes
// to the Santa motion (santaMotion.ts), whose frames place the marker
// with `setLngLat` and turn its heading indicator (santaPin.ts) the short
// way to the heading minus the map's bearing (`getBearing`), so the
// chevron points along the map as it is turned; the last heading is
// applied again at the new bearing on every `rotate` and `rotateend`,
// which also report the bearing through `onBearingChange`. The marker
// keeps MapLibre's default rotation alignment and the image never
// rotates. A theme change recolours the indicator. While
// following, a frame checks the follow rule (src/map/follow.ts): when the
// displayed position, through `project`, has left the central box of the
// container and the last follow pan started at least 500 ms ago (so the
// one before it is over), it makes one `easeTo` there of FOLLOW_PAN_MS,
// with the centre only, so zoom and bearing are untouched, and no other
// camera call. `recenter` makes one animated `panTo` there and the rule
// applies again on `moveend`. A two-finger twist keeps Follow. A
// one-pointer drag past 4 px, a wheel, a double tap, a drag whose
// `dragstart` carries an `originalEvent` once the centre has moved more
// than DRAG_SLOP_PX (12 px, through `project`) from where it began, or a
// `zoomstart` with an `originalEvent` (a pinch) turns Follow off and stops
// a running follow pan with `stop`; `watchGestures` leaves two or more
// pointers to those map events. `zoomBy` and `resetNorth` (one `easeTo`
// to bearing 0 of 300 ms) keep it. The markers keep
// MapLibre's whole pixel positioning.
// The viewpoints are HTML markers holding the
// same badges and popover (viewpointsOverlay.ts), rebuilt only when the
// list says something new; the viewer's location is an HTML marker and a
// dotted line (userLocation.ts), the line fading toward the dot while the
// viewer is outside the box, where the dot follows the view on its own
// through the marker and the line source's `setData`.
// The map is locked to the event box: `maxBounds` and the least zoom that
// fits it (recomputed when the container resizes), and every pan the
// controller makes clamped to it. A fix outside the box draws Santa on its
// edge and follows there; a flight history point outside it is drawn but left
// out of `fitHistory`. The first view is the event's start view, its zoom
// raised to the least zoom when the box forces a larger one, and without
// one the box fitted; a fix in hand at mount leaves it as it is, and a
// follow pan moves to Santa at that zoom when he stands outside the
// central box.
// A style error before the first `idle`, or a lost WebGL context that is
// not restored within 5 s, reports through `onFail` once. `destroy` removes
// the map, its markers, the container listeners, and every timer; every
// method is a no-op after it.

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
  viewpointsSignature,
  type TrackerViewpoint,
  type ViewpointBadges,
} from "../map/viewpointsOverlay";
import { createSantaPinElement, santaHeadingColor } from "../map/santaPin";
import { SANTA_MARKER_HEIGHT, SIGNAL_LOST_FILTER } from "../map/santaMarker";
import { clampToBbox, inBox, MIN_ZOOM_FLOOR, type LatLng } from "../map/bounds";
import { ensureProtocol, NORTH_UP_MS, OSM_ATTRIBUTION, watchContext, type MapLibreFailure } from "./handle";
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
import {
  createSantaMotion,
  followPageVisibility,
  RECENTER_PAN_MS,
  type SantaFrame,
} from "../map/santaMotion";
import {
  DRAG_SLOP_PX,
  FOLLOW_PAN_MS,
  followEasing,
  followPanDue,
  needsPan,
  watchGestures,
} from "../map/follow";
import { createMapLibreUserLocation, type MapLibreUserLocation } from "./userLocation";

export type MaplibreControllerOptions = MapControllerOptions & {
  trackerMap: TrackerMap;
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
    if (line !== null) extra.push(userLineLayers(theme, line[0], line[1], userLoc?.getState().outside === true));
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

  // The first view: the start view at no less than the least zoom, the box
  // fitted without one, the world at the least zoom without a box either.
  const leastZoom = mapBounds(bbox, viewport(), trackerMap).minZoom ?? MIN_ZOOM_FLOOR;
  const start = opts.startView;
  const startZoom = start !== null ? Math.max(start.zoom, leastZoom) : leastZoom;
  function initialView(): { bounds: LngLatBoundsLike } | { center: [number, number]; zoom: number } {
    if (start !== null) {
      const at = clamp(start.center);
      return { center: [at.lng, at.lat], zoom: startZoom };
    }
    if (bbox !== null) return { bounds: [[bbox.west, bbox.south], [bbox.east, bbox.north]] };
    return { center: [0, 0], zoom: startZoom };
  }

  let userLoc: MapLibreUserLocation | null = null;
  const map = new MapLibreMap({
    container,
    style: buildStyle(startZoom),
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
  // MapLibre 6 awaits this resolver before it gives up on an image; a
  // styleimagemissing listener runs too late for the tile that asked.
  map.setMissingStyleImageResolver((id) => {
    if (disposed || id !== ROUTE_ARROW_ICON || map.hasImage(ROUTE_ARROW_ICON)) return;
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

  // The Santa pin, its tip (the wrapper's bottom centre) on the fix.
  const pin = createSantaPinElement(SANTA_MARKER_HEIGHT, santaHeadingColor(theme));
  pin.element.setAttribute("data-testid", "santa-marker");
  const santa = opts.showSantaMarker ? new Marker({ element: pin.element, anchor: "bottom" }) : null;
  let santaShown = false;
  // Where the pin stands now, clamped to the box.
  let displayed: LatLng | null = null;
  // While a recenter's pan runs, frames leave the camera alone.
  let recentering: ReturnType<typeof setTimeout> | null = null;
  // When the last follow pan started, on the frames' clock; null for none
  // since Follow last came on.
  let lastFollowPan: number | null = null;
  let localSeq = 0;
  // The heading the indicator last showed, applied again as the map turns.
  let shownHeading: number | null = null;

  function place(frame: SantaFrame): void {
    if (disposed) return;
    displayed = clamp({ lat: frame.lat, lng: frame.lng });
    if (santa !== null) {
      santa.setLngLat([displayed.lng, displayed.lat]);
      shownHeading = frame.headingDeg;
      pin.setHeading(frame.headingDeg, map.getBearing());
      if (!santaShown) santa.addTo(map);
      santaShown = true;
    }
    keepUp();
  }

  // The follow rule: one short eased pan to the displayed position once it
  // leaves the central box, at most one every FOLLOW_GAP_MS.
  function keepUp(): void {
    if (disposed || !following || displayed === null) return;
    if (recentering !== null) return;
    const pixel = map.project([displayed.lng, displayed.lat]);
    if (!needsPan({ x: pixel.x, y: pixel.y }, viewport())) return;
    const now = performance.now();
    if (!followPanDue(now, lastFollowPan)) return;
    lastFollowPan = now;
    map.easeTo({ center: [displayed.lng, displayed.lat], duration: FOLLOW_PAN_MS, easing: followEasing });
  }

  // Forgets the last follow pan, and with `halt` stops it where it is
  // while it still runs.
  function endFollowPan(halt: boolean): void {
    if (lastFollowPan === null) return;
    const running = performance.now() - lastFollowPan < FOLLOW_PAN_MS;
    lastFollowPan = null;
    if (halt && running) map.stop();
  }

  function endRecenter(): void {
    if (recentering === null) return;
    clearTimeout(recentering);
    recentering = null;
  }

  const motion = createSantaMotion({
    now: () => performance.now(),
    raf: (cb) => requestAnimationFrame(cb),
    caf: (id) => cancelAnimationFrame(id),
    sink: place,
  });
  const stopVisibility = followPageVisibility(motion);

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
    stopVisibility();
    motion.dispose();
    stopContextWatch();
    observer?.disconnect();
    map.remove();
    throw err;
  }

  function stopFollowing(): void {
    if (disposed) return;
    endFollowPan(true);
    if (!following) return;
    following = false;
    opts.onFollowChange?.(false);
  }

  // A gesture turns Follow off; a programmatic camera call (`zoomBy`,
  // `resetNorth`, a pan of the controller's own) has no `originalEvent`
  // and keeps it, and a twist alone keeps it too.
  const stopGestures = watchGestures(container, stopFollowing, { mapDecidesMultiTouch: true });
  const byGesture = (event?: unknown) =>
    (event as { originalEvent?: unknown } | undefined)?.originalEvent != null;
  // Where the centre stood when the gesture's drag began, and its pixel
  // then; null while no gesture drags.
  let dragFrom: { at: [number, number]; pixel: { x: number; y: number } } | null = null;
  map.on("dragstart", (event?: unknown) => {
    if (disposed || !byGesture(event)) return;
    const centre = map.getCenter();
    const at: [number, number] = [centre.lng, centre.lat];
    const pixel = map.project(at);
    dragFrom = { at, pixel: { x: pixel.x, y: pixel.y } };
  });
  map.on("drag", () => {
    if (disposed || dragFrom === null) return;
    const now = map.project(dragFrom.at);
    if (Math.hypot(now.x - dragFrom.pixel.x, now.y - dragFrom.pixel.y) <= DRAG_SLOP_PX) return;
    dragFrom = null;
    stopFollowing();
  });
  map.on("dragend", () => {
    dragFrom = null;
  });
  map.on("zoomstart", (event?: unknown) => {
    if (byGesture(event)) stopFollowing();
  });
  // The indicator reads along the map while it turns.
  const turned = () => {
    if (disposed) return;
    const b = map.getBearing();
    pin.setHeading(shownHeading, b);
    opts.onBearingChange?.(b);
  };
  map.on("rotate", turned);
  map.on("rotateend", turned);
  map.on("moveend", () => {
    if (!disposed) endRecenter();
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
    map.panTo([p.lng, p.lat], { animate: true });
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
      pin.setColor(santaHeadingColor(t));
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
      if (state === "waitingForFix") {
        displayed = null;
        if (santaShown) santa?.remove();
        santaShown = false;
      } else {
        const variant = state === "signalLost" ? "signalLost" : "tracking";
        pin.image.style.filter = variant === "signalLost" ? SIGNAL_LOST_FILTER : "";
        pin.element.setAttribute("data-variant", variant);
      }
      if (state === "waitingForFix" || pos === null) {
        motion.rest();
      } else if (seqChanged || !motion.hasFix()) {
        motion.push(
          { seq: pos.seq ?? --localSeq, lat: pos.lat, lng: pos.lng, headingDeg: pos.headingDeg ?? null },
          performance.now(),
        );
      }
      userLoc?.setSanta(pos === null ? null : { lat: pos.lat, lng: pos.lng });
    },
    follow(on) {
      if (disposed) return;
      if (!on) endFollowPan(true);
      following = on;
      opts.onFollowChange?.(on);
    },
    recenter(pos) {
      if (disposed) return;
      const target = displayed ?? (pos === null ? null : clamp(pos));
      if (target !== null) {
        endRecenter();
        endFollowPan(false);
        recentering = setTimeout(() => {
          recentering = null;
        }, RECENTER_PAN_MS);
        panTo(target);
      }
      following = true;
      opts.onFollowChange?.(true);
    },
    zoomBy(delta) {
      if (disposed) return;
      map.setZoom(zoom() + delta);
    },
    resetNorth() {
      if (disposed) return;
      map.easeTo({ bearing: 0, duration: NORTH_UP_MS });
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
      map.fitBounds(bounds, { padding, animate: true });
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
      endRecenter();
      stopGestures();
      stopVisibility();
      motion.dispose();
      santa?.remove();
      userLoc?.destroy();
      userLoc = null;
      map.remove();
    },
  };
}
