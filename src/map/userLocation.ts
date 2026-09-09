// docs/site.md section 8.6. User location: `watchPosition`, a pulsing
// marker, a dotted line to Santa, and distance in feet under a mile,
// miles above. State is per page load; nothing about location is
// persisted.

import { metresToFeet, metresToMiles } from "../lib/units";
import type { MapTheme } from "./themes";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const ONE_MILE_M = 1609.344;

export function formatDistanceMetres(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "";
  if (m < ONE_MILE_M) {
    const feet = Math.round(metresToFeet(m));
    return `${feet.toLocaleString("en-US")} ft`;
  }
  const miles = metresToMiles(m);
  const rounded = Math.round(miles * 100) / 100;
  return `${rounded.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
}

export type UserLocationState = {
  enabled: boolean;
  position: google.maps.LatLngLiteral | null;
  error: GeolocationPositionError["code"] | null;
  distanceMetres: number | null;
};

type Libs = {
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
  geometry: google.maps.GeometryLibrary;
};

export type UserLocation = {
  enable(): Promise<void>;
  disable(): void;
  setTheme(theme: MapTheme): void;
  setSanta(pos: google.maps.LatLngLiteral | null): void;
  getState(): UserLocationState;
  destroy(): void;
};

export function createUserLocation(
  libs: Libs,
  map: google.maps.Map,
  initialTheme: MapTheme,
  onChange: (s: UserLocationState) => void,
): UserLocation {
  let theme = initialTheme;
  let santa: google.maps.LatLngLiteral | null = null;
  let state: UserLocationState = {
    enabled: false,
    position: null,
    error: null,
    distanceMetres: null,
  };
  let userMarker: google.maps.Marker | null = null;
  let line: google.maps.Polyline | null = null;
  let watchId: number | null = null;
  let pulseTimer: number | null = null;
  let visible = true;

  function computeDistance(): number | null {
    if (state.position === null || santa === null) return null;
    try {
      const from = new google.maps.LatLng(state.position.lat, state.position.lng);
      const to = new google.maps.LatLng(santa.lat, santa.lng);
      return libs.geometry.spherical.computeDistanceBetween(from, to);
    } catch {
      return null;
    }
  }

  function ensureMarker() {
    if (userMarker !== null) return;
    userMarker = new libs.marker.Marker({
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: theme.userColor,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
    });
    if (!prefersReducedMotion() && pulseTimer === null && typeof window !== "undefined") {
      pulseTimer = window.setInterval(() => {
        if (userMarker === null) return;
        visible = !visible;
        userMarker.setVisible(visible);
      }, 600);
    }
  }

  function redrawLine() {
    if (state.position === null || santa === null) {
      line?.setMap(null);
      line = null;
      return;
    }
    if (line !== null) {
      line.setPath([santa, state.position]);
      line.setOptions({
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 2,
              fillColor: theme.routeColor,
              fillOpacity: 1,
              strokeColor: theme.routeColor,
            },
            offset: "0",
            repeat: "10px",
          },
        ],
      });
      return;
    }
    line = new libs.maps.Polyline({
      map,
      path: [santa, state.position],
      strokeOpacity: 0,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 2,
            fillColor: theme.routeColor,
            fillOpacity: 1,
            strokeColor: theme.routeColor,
          },
          offset: "0",
          repeat: "10px",
        },
      ],
    });
  }

  function publish() {
    state = { ...state, distanceMetres: computeDistance() };
    onChange(state);
  }

  function clearWatch() {
    if (watchId !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  function removeMarker() {
    userMarker?.setMap(null);
    userMarker = null;
    line?.setMap(null);
    line = null;
    if (pulseTimer !== null && typeof window !== "undefined") {
      window.clearInterval(pulseTimer);
      pulseTimer = null;
    }
    visible = true;
  }

  function onFix(pos: GeolocationPosition) {
    state = {
      enabled: true,
      position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      error: null,
      distanceMetres: null,
    };
    ensureMarker();
    if (userMarker !== null && state.position !== null) userMarker.setPosition(state.position);
    redrawLine();
    publish();
  }

  function onError(err: GeolocationPositionError) {
    state = { enabled: false, position: null, error: err.code, distanceMetres: null };
    removeMarker();
    onChange(state);
  }

  async function enable() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      state = {
        enabled: false,
        position: null,
        error: 2 as GeolocationPositionError["code"],
        distanceMetres: null,
      };
      onChange(state);
      return;
    }
    try {
      const perms = (navigator as Navigator & {
        permissions?: { query: (q: { name: PermissionName }) => Promise<{ state: string }> };
      }).permissions;
      if (perms && typeof perms.query === "function") {
        const status = await perms.query({ name: "geolocation" as PermissionName });
        if (status.state === "denied") {
          state = {
            enabled: false,
            position: null,
            error: 1 as GeolocationPositionError["code"],
            distanceMetres: null,
          };
          onChange(state);
          return;
        }
      }
    } catch {
      // Fall through and try the geolocation API directly.
    }
    state = { ...state, enabled: true };
    onChange(state);
    watchId = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });
  }

  function disable() {
    clearWatch();
    removeMarker();
    state = { enabled: false, position: null, error: null, distanceMetres: null };
    onChange(state);
  }

  function setTheme(t: MapTheme) {
    theme = t;
    if (userMarker !== null) {
      userMarker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: theme.userColor,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      });
    }
    redrawLine();
  }

  function setSanta(pos: google.maps.LatLngLiteral | null) {
    santa = pos;
    redrawLine();
    publish();
  }

  function destroy() {
    clearWatch();
    removeMarker();
  }

  return { enable, disable, setTheme, setSanta, getState: () => state, destroy };
}
