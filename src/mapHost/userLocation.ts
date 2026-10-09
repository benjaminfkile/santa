// docs/site.md sections 8.6 and 8.10. The viewer's location on the MapLibre
// tracker: the same `watchPosition` and state as the Google form
// (src/map/userLocation.ts), drawn as an HTML marker (a 16 px circle in the
// theme's `overlay.userColor`, pulsing every PULSE_MS unless reduced
// motion) and a dotted line to Santa that the controller draws in its
// style from `line()`. With the event box given, the marker and both ends
// of the line sit clamped to it, while the distance is always measured
// between the true positions (on the same sphere as Google's geometry
// library). Nothing about location is persisted. After `destroy` nothing
// starts a watch, draws, or reports a change, even an `enable` whose
// permission query settles later.

import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { UserLocationState } from "../map/userLocation";
import type { MapTheme } from "../map/themes";
import { clampToBbox, type Bbox, type LatLng } from "../map/bounds";

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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  let state: UserLocationState = { enabled: false, position: null, error: null, distanceMetres: null };
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

  function drawn(p: LatLng): LatLng {
    return bbox === null ? p : clampToBbox(p, bbox);
  }

  function computeDistance(): number | null {
    if (state.position === null || santa === null) return null;
    return distanceMetres(state.position, santa);
  }

  function paint(): void {
    element.style.background = theme.overlay.userColor;
  }

  function placeMarker(): void {
    if (state.position === null) return;
    const at = drawn(state.position);
    paint();
    if (marker === null) {
      marker = new Marker({ element, anchor: "center" }).setLngLat([at.lng, at.lat]).addTo(map);
    } else {
      marker.setLngLat([at.lng, at.lat]);
    }
    if (pulseTimer === null && !prefersReducedMotion()) {
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
    state = {
      enabled: true,
      position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      error: null,
      distanceMetres: null,
    };
    placeMarker();
    onLineChange();
    publish();
  }

  function onError(err: GeolocationPositionError): void {
    if (destroyed) return;
    state = { enabled: false, position: null, error: err.code, distanceMetres: null };
    removeMarker();
    onLineChange();
    onChange(state);
  }

  async function enable(): Promise<void> {
    if (destroyed) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      state = { enabled: false, position: null, error: 2, distanceMetres: null };
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
          state = { enabled: false, position: null, error: 1, distanceMetres: null };
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
      state = { enabled: false, position: null, error: null, distanceMetres: null };
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
    line() {
      if (destroyed || state.position === null || santa === null) return null;
      return [drawn(santa), drawn(state.position)];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearWatch();
      removeMarker();
    },
  };
}
