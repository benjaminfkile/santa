// docs/site.md sections 8.6 and 8.10. The viewer's location on the MapLibre
// tracker: the same `watchPosition` and state as the Google form
// (src/map/userLocation.ts), drawn as an HTML marker (a 16 px circle in the
// theme's `overlay.userColor`, pulsing every PULSE_MS) and a dotted line to
// Santa that the controller draws in its style from `line()`. With the
// event box given, Santa's end of the line sits clamped to it, and so do
// the marker and the visitor's end inside the box, while the distance is
// always measured between the true positions (on the same sphere as
// Google's geometry library). A fix outside the box sets `outside`: the
// visitor is drawn at the true position clamped to OUTSIDE_SHIFT_PX inside
// the viewport edge (src/map/outsideMarker.ts), and when the clamp moves
// it a chevron child element points toward the true position; the
// controller fades the line toward the dot. On every `move` and `resize`
// of the map that point is recomputed: the marker moves with `setLngLat`
// and the line's source takes `setData`, with no style rebuild; only a
// line appearing, disappearing, or a moved Santa calls `onLineChange`.
// Nothing about location is persisted. After `destroy` nothing
// starts a watch, draws, or reports a change, even an `enable` whose
// permission query settles later.

import { Marker, type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import type { UserLocationState } from "../map/userLocation";
import type { MapTheme } from "../map/themes";
import { clampToBbox, inBox, type Bbox, type LatLng } from "../map/bounds";
import {
  CHEVRON_OFFSET_PX,
  CHEVRON_PATH,
  CHEVRON_SIZE_PX,
  initialBearing,
  clampToViewport,
} from "../map/outsideMarker";
import { USER_LINE_SOURCE } from "./routeLayers";

export type { UserLocationState } from "../map/userLocation";

export const USER_MARKER_SIZE = 16;
export const PULSE_MS = 600;

// The radius Google's `computeDistanceBetween` measures on, in metres.
const EARTH_RADIUS_M = 6378137;

export function distanceMetres(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type MapLibreUserLocation = {
  enable(): Promise<void>;
  disable(): void;
  setTheme(theme: MapTheme): void;
  setSanta(pos: LatLng | null): void;
  getState(): UserLocationState;
  // The dotted line's two ends as drawn (Santa first), or null.
  line(): [LatLng, LatLng] | null;
  destroy(): void;
};

export function createMapLibreUserLocation(
  map: MapLibreMap,
  initialTheme: MapTheme,
  onChange: (s: UserLocationState) => void,
  onLineChange: () => void,
  bbox: Bbox | null,
): MapLibreUserLocation {
  let theme = initialTheme;
  let santa: LatLng | null = null;
  let state: UserLocationState = {
    enabled: false,
    position: null,
    error: null,
    distanceMetres: null,
    outside: false,
  };
  let marker: Marker | null = null;
  let watchId: number | null = null;
  let pulseTimer: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;

  const element = document.createElement("div");
  element.setAttribute("data-testid", "user-location-marker");
  element.setAttribute("aria-hidden", "true");
  element.style.width = `${USER_MARKER_SIZE}px`;
  element.style.height = `${USER_MARKER_SIZE}px`;
  element.style.borderRadius = "50%";
  element.style.boxSizing = "border-box";
  element.style.border = "2px solid var(--text-bright)";
  element.style.pointerEvents = "none";
  element.style.position = "relative";

  // The chevron, centred on the dot and pushed CHEVRON_OFFSET_PX out along
  // the bearing; in the dot's colour with its stroke, pulsing with it.
  const SVG_NS = "http://www.w3.org/2000/svg";
  const chevron = document.createElementNS(SVG_NS, "svg");
  chevron.setAttribute("data-testid", "user-location-chevron");
  const box = CHEVRON_SIZE_PX + 2;
  chevron.setAttribute("width", String(box));
  chevron.setAttribute("height", String(box));
  chevron.setAttribute("viewBox", `${-box / 2} ${-box / 2} ${box} ${box}`);
  chevron.style.position = "absolute";
  chevron.style.left = "50%";
  chevron.style.top = "50%";
  chevron.style.overflow = "visible";
  const chevronPath = document.createElementNS(SVG_NS, "path");
  chevronPath.setAttribute("d", CHEVRON_PATH);
  chevronPath.setAttribute("stroke", "var(--text-bright)");
  chevronPath.setAttribute("stroke-width", "2");
  chevronPath.setAttribute("stroke-linejoin", "round");
  chevron.appendChild(chevronPath);

  function drawn(p: LatLng): LatLng {
    return bbox === null ? p : clampToBbox(p, bbox);
  }

  // Where the visitor is drawn, and whether the viewport clamp moved it
  // there: inside the box the box clamp; outside it the true position
  // clamped inside the viewport edge, or on the box edge while the
  // container has no size.
  function visitorAt(p: LatLng): { at: LatLng; moved: boolean } {
    if (!state.outside) return { at: drawn(p), moved: false };
    const container = map.getContainer();
    const size = { width: container.clientWidth, height: container.clientHeight };
    if (size.width === 0 || size.height === 0) return { at: drawn(p), moved: true };
    const pixel = map.project([p.lng, p.lat]);
    const clamped = clampToViewport({ x: pixel.x, y: pixel.y }, size);
    if (!clamped.moved) return { at: p, moved: false };
    const at = map.unproject([clamped.point.x, clamped.point.y]);
    return { at: { lat: at.lat, lng: at.lng }, moved: true };
  }

  function computeDistance(): number | null {
    if (state.position === null || santa === null) return null;
    return distanceMetres(state.position, santa);
  }

  function paint(): void {
    element.style.background = theme.overlay.userColor;
    chevronPath.setAttribute("fill", theme.overlay.userColor);
  }

  // No chevron unless the viewport clamp moved the dot; then the chevron
  // turned to the bearing from the drawn point to the true one.
  function outsideLook(at: LatLng, position: LatLng, moved: boolean): void {
    if (!moved) {
      chevron.remove();
      return;
    }
    const rotate = Math.round(initialBearing(at, position) * 10) / 10;
    chevron.style.transform =
      `translate(-50%, -50%) rotate(${rotate}deg) translateY(${-CHEVRON_OFFSET_PX}px)`;
    if (chevron.parentNode !== element) element.appendChild(chevron);
  }

  function placeMarker(): void {
    if (state.position === null) return;
    const { at, moved } = visitorAt(state.position);
    paint();
    outsideLook(at, state.position, moved);
    if (marker === null) {
      marker = new Marker({ element, anchor: "center" }).setLngLat([at.lng, at.lat]).addTo(map);
    } else {
      marker.setLngLat([at.lng, at.lat]);
    }
    if (pulseTimer === null) {
      pulseTimer = setInterval(() => {
        element.style.visibility = element.style.visibility === "hidden" ? "" : "hidden";
      }, PULSE_MS);
    }
  }

  function removeMarker(): void {
    marker?.remove();
    marker = null;
    if (pulseTimer !== null) clearInterval(pulseTimer);
    pulseTimer = null;
    element.style.visibility = "";
  }

  function line(): [LatLng, LatLng] | null {
    if (destroyed || state.position === null || santa === null) return null;
    return [drawn(santa), visitorAt(state.position).at];
  }

  // Moves the outside dot and the line's visitor end to the current view.
  function followView(): void {
    if (destroyed || !state.outside || state.position === null) return;
    placeMarker();
    const ends = line();
    const source = map.getSource<GeoJSONSource>(USER_LINE_SOURCE);
    if (ends === null || source === undefined) return;
    source.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [[ends[0].lng, ends[0].lat], [ends[1].lng, ends[1].lat]],
      },
    });
  }

  if (bbox !== null) {
    map.on("move", followView);
    map.on("resize", followView);
  }

  function publish(): void {
    if (destroyed) return;
    state = { ...state, distanceMetres: computeDistance() };
    onChange(state);
  }

  function clearWatch(): void {
    if (watchId !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
  }

  function onFix(pos: GeolocationPosition): void {
    if (destroyed) return;
    const position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    state = {
      enabled: true,
      position,
      error: null,
      distanceMetres: null,
      outside: bbox !== null && !inBox(position, bbox),
    };
    placeMarker();
    onLineChange();
    publish();
  }

  function onError(err: GeolocationPositionError): void {
    if (destroyed) return;
    state = { enabled: false, position: null, error: err.code, distanceMetres: null, outside: false };
    removeMarker();
    onLineChange();
    onChange(state);
  }

  async function enable(): Promise<void> {
    if (destroyed) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      state = { enabled: false, position: null, error: 2, distanceMetres: null, outside: false };
      onChange(state);
      return;
    }
    try {
      const perms = (navigator as Navigator & {
        permissions?: { query: (q: { name: PermissionName }) => Promise<{ state: string }> };
      }).permissions;
      if (perms && typeof perms.query === "function") {
        const status = await perms.query({ name: "geolocation" as PermissionName });
        if (destroyed) return;
        if (status.state === "denied") {
          state = { enabled: false, position: null, error: 1, distanceMetres: null, outside: false };
          onChange(state);
          return;
        }
      }
    } catch {
      // Fall through and try the geolocation API directly.
    }
    if (destroyed) return;
    state = { ...state, enabled: true };
    onChange(state);
    watchId = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });
  }

  return {
    enable,
    disable() {
      if (destroyed) return;
      clearWatch();
      removeMarker();
      state = { enabled: false, position: null, error: null, distanceMetres: null, outside: false };
      onLineChange();
      onChange(state);
    },
    setTheme(t) {
      if (destroyed) return;
      theme = t;
      paint();
    },
    setSanta(pos) {
      if (destroyed) return;
      const moved = (santa === null) !== (pos === null) ||
        (santa !== null && pos !== null && (santa.lat !== pos.lat || santa.lng !== pos.lng));
      santa = pos;
      if (moved && state.position !== null) onLineChange();
      publish();
    },
    getState: () => state,
    line,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      map.off("move", followView);
      map.off("resize", followView);
      clearWatch();
      removeMarker();
    },
  };
}
