// docs/site.md section 8.3. Owns the `google.maps.Map`, the Santa marker,
// the flight history overlay, the viewpoints overlay, the user location, and
// the map styles (the theme's with the section's place filter on top).
// Subscribes to the store once and moves the marker imperatively; React
// never re-renders on a fix. `destroy` removes the map listeners and pending timers, and every
// method is a no-op afterwards, so a late call or a late map event on a
// disposed controller draws nothing and calls back into nothing.
// The map is locked to the event box (8.2): a strict restriction to it, a
// minimum zoom that fits it in the canvas (recomputed when the canvas
// resizes), and every pan the controller makes clamped to it. A fix
// outside the box draws Santa on its edge and pans there; a flight history
// point outside it is drawn but left out of `fitHistory`. `setTheme`
// awaits the theme's style body before applying it; a later call wins over
// an earlier one still waiting.

import type { LiveState } from "../store/liveState";
import { createSantaMarker, type SantaMarker } from "./santaMarker";
import {
  createFlightHistoryOverlay,
  type FlightHistoryOverlay,
  type HistoryPoint,
} from "./flightHistoryOverlay";
import {
  createViewpointsOverlay,
  type ViewpointsOverlay,
  type MountIcon,
  type TrackerViewpoint,
} from "./viewpointsOverlay";
import { createUserLocation, type UserLocation, type UserLocationState } from "./userLocation";
import type { MapsLibs } from "./loadMaps";
import type { MapTheme, ThemeStyle } from "./themes";
import { poiStyles, type PoiFilter } from "./poiStyles";
import { clampToBbox, fittedMinZoom, inBox, MIN_ZOOM_FLOOR, type Bbox } from "./bounds";

export type MapControllerOptions = {
  theme: MapTheme;
  // The starting theme's style body, already fetched.
  style: ThemeStyle;
  bbox: Bbox | null;
  defaultCenter: google.maps.LatLngLiteral;
  defaultZoom: number;
  showSantaMarker: boolean;
  showUserLocation: boolean;
  mountIcon?: MountIcon;
  onFollowChange?: (following: boolean) => void;
  onUserLocationChange?: (s: UserLocationState) => void;
};

export type MapController = {
  setTheme(theme: MapTheme): Promise<void>;
  setPois(filter: PoiFilter): void;
  setMapType(type: "terrain" | "roadmap"): void;
  setFlightHistory(points: HistoryPoint[] | null): void;
  setViewpoints(list: readonly TrackerViewpoint[]): void;
  setToggles(t: { flightHistory?: boolean; timeLabels?: boolean; landmarks?: boolean }): void;
  setLiveFix(
    state: LiveState,
    pos: google.maps.LatLngLiteral | null,
    seqChanged: boolean,
  ): void;
  follow(on: boolean): void;
  recenter(pos: google.maps.LatLngLiteral | null): void;
  zoomBy(delta: number): void;
  fitHistory(): void;
  enableUserLocation(): Promise<void>;
  disableUserLocation(): void;
  getUserLocation(): UserLocationState | null;
  destroy(): void;
};

export function createMapController(
  libs: MapsLibs,
  container: HTMLElement,
  opts: MapControllerOptions,
): MapController {
  let theme = opts.theme;
  let pois: PoiFilter = null;
  let points: HistoryPoint[] | null = null;
  let toggles = { flightHistory: false, timeLabels: true, landmarks: true };
  let following = true;
  let santa: SantaMarker | null = null;
  let userLoc: UserLocation | null = null;
  let zoomDebounce: number | null = null;
  let disposed = false;
  let themeRequest = 0;
  let styles = googleStyles(opts.style);
  const bbox = opts.bbox;

  function clamp(p: google.maps.LatLngLiteral): google.maps.LatLngLiteral {
    return bbox === null ? p : clampToBbox(p, bbox);
  }

  function minZoom(): number {
    if (bbox === null) return MIN_ZOOM_FLOOR;
    return fittedMinZoom(bbox, { width: container.clientWidth, height: container.clientHeight });
  }

  const map = new libs.maps.Map(container, {
    center: clamp(opts.defaultCenter),
    zoom: opts.defaultZoom,
    ...(bbox !== null
      ? { restriction: { latLngBounds: bbox, strictBounds: true } }
      : {}),
    minZoom: minZoom(),
    mapTypeId: "terrain",
    disableDefaultUI: true,
    gestureHandling: "greedy",
    clickableIcons: false,
    keyboardShortcuts: true,
    styles,
  });

  let resizeObserver: ResizeObserver | null = null;
  if (bbox !== null && typeof ResizeObserver !== "undefined") {
    let lastMinZoom = minZoom();
    resizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      const next = minZoom();
      if (next === lastMinZoom) return;
      lastMinZoom = next;
      map.setOptions({ minZoom: next });
    });
    resizeObserver.observe(container);
  }

  let overlay: FlightHistoryOverlay = createFlightHistoryOverlay(libs, map, null);
  // The viewpoint popover lives in the map view wrapper, whose box is the
  // canvas's box, so the map's container pixels are its pixels.
  const popoverHost = container.parentElement ?? container;
  let viewpoints: ViewpointsOverlay = createViewpointsOverlay(libs, map, [], null, popoverHost);
  let viewpointsKey = viewpointsSignature([]);

  function updateViewpoints(): void {
    viewpoints.update({ visible: toggles.landmarks, zoom: map.getZoom() ?? opts.defaultZoom });
  }

  // A build that fails part way detaches what it already put on the map
  // before the error reaches MapView's retry.
  try {
    if (opts.showSantaMarker) {
      santa = createSantaMarker(libs, map);
    }

    if (opts.showUserLocation) {
      userLoc = createUserLocation(
        libs,
        map,
        theme,
        (s) => {
          opts.onUserLocationChange?.(s);
        },
        bbox,
      );
    }
  } catch (err) {
    resizeObserver?.disconnect();
    overlay.destroy();
    santa?.destroy();
    userLoc?.destroy();
    throw err;
  }

  const listeners: google.maps.MapsEventListener[] = [];

  listeners.push(map.addListener("dragstart", () => {
    if (disposed) return;
    if (following) {
      following = false;
      opts.onFollowChange?.(false);
    }
  }));

  listeners.push(map.addListener("zoom_changed", () => {
    if (disposed) return;
    updateViewpoints();
    if (zoomDebounce !== null) window.clearTimeout(zoomDebounce);
    zoomDebounce = window.setTimeout(() => {
      zoomDebounce = null;
      if (disposed) return;
      overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);
    }, 150);
  }));

  overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);

  return {
    async setTheme(t) {
      if (disposed) return;
      const request = ++themeRequest;
      const style = await t.getStyle();
      if (disposed || request !== themeRequest) return;
      theme = t;
      styles = googleStyles(style);
      map.setOptions({ styles: poiStyles(styles, pois) });
      overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);
      userLoc?.setTheme(theme);
    },
    setPois(filter) {
      if (disposed) return;
      pois = filter;
      map.setOptions({ styles: poiStyles(styles, pois) });
    },
    setMapType(type) {
      if (disposed) return;
      map.setMapTypeId(type);
    },
    setFlightHistory(p) {
      if (disposed) return;
      points = p;
      overlay.destroy();
      overlay = createFlightHistoryOverlay(libs, map, points);
      overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);
    },
    setViewpoints(list) {
      if (disposed) return;
      // Rebuilding drops an open popover and makes every badge blink, so a
      // list that says the same thing as the one on the map is a no-op.
      const key = viewpointsSignature(list);
      if (key === viewpointsKey) return;
      viewpointsKey = key;
      viewpoints.destroy();
      viewpoints = createViewpointsOverlay(libs, map, list, opts.mountIcon ?? null, popoverHost);
      updateViewpoints();
    },
    setToggles(t) {
      if (disposed) return;
      toggles = {
        flightHistory: t.flightHistory ?? toggles.flightHistory,
        timeLabels: t.timeLabels ?? toggles.timeLabels,
        landmarks: t.landmarks ?? toggles.landmarks,
      };
      overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);
      updateViewpoints();
    },
    setLiveFix(state, pos, seqChanged) {
      if (disposed) return;
      const shown = pos === null ? null : clamp(pos);
      santa?.setState(state, shown);
      userLoc?.setSanta(pos);
      if (following && seqChanged && shown !== null) map.panTo(shown);
    },
    follow(on) {
      if (disposed) return;
      following = on;
      opts.onFollowChange?.(on);
    },
    recenter(pos) {
      if (disposed) return;
      if (pos !== null) map.panTo(clamp(pos));
      following = true;
      opts.onFollowChange?.(true);
    },
    zoomBy(delta) {
      if (disposed) return;
      const z = map.getZoom() ?? opts.defaultZoom;
      map.setZoom(z + delta);
    },
    fitHistory() {
      if (disposed) return;
      const pts = (points ?? []).filter(
        (p) =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          (bbox === null || inBox(p, bbox)),
      );
      if (pts.length === 0) return;
      const bounds = new google.maps.LatLngBounds();
      for (const p of pts) bounds.extend({ lat: p.lat, lng: p.lng });
      map.fitBounds(bounds);
    },
    enableUserLocation: () => userLoc?.enable() ?? Promise.resolve(),
    disableUserLocation: () => userLoc?.disable(),
    getUserLocation: () => userLoc?.getState() ?? null,
    destroy() {
      if (disposed) return;
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      for (const l of listeners) l.remove();
      listeners.length = 0;
      overlay.destroy();
      viewpoints.destroy();
      santa?.destroy();
      santa = null;
      userLoc?.destroy();
      userLoc = null;
      if (zoomDebounce !== null) {
        window.clearTimeout(zoomDebounce);
        zoomDebounce = null;
      }
    },
  };
}

// A Google theme's body is a JSON style array; anything else styles nothing.
function googleStyles(style: ThemeStyle): google.maps.MapTypeStyle[] {
  return Array.isArray(style) ? style : [];
}

// What the overlay draws from a viewpoint: its place, its name, its icon, and
// its description. Two lists with the same signature draw the same badges.
function viewpointsSignature(list: readonly TrackerViewpoint[]): string {
  return JSON.stringify(
    list.map((l) => [l.lat, l.lng, l.name, l.icon ?? null, l.description ?? null]),
  );
}
