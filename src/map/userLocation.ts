// docs/site.md section 8.6. User location: `watchPosition`, a pulsing
// marker, a dotted line to Santa, and distance in feet under a mile,
// miles above. State is per page load; nothing about location is
// persisted. The dot rebuilds its icon from the tokens on every
// colour-scheme change and renders nothing until the tokens resolve.
// After `destroy` nothing starts a watch, draws, or reports a change, even
// an `enable` whose permission query settles later.
// With the event box given, the marker and both ends of the line are drawn
// clamped to it, while the distance is always measured between the true
// positions. A fix outside the box sets `outside`: the marker becomes an
// SVG icon holding the dot and a chevron pointing toward the true position,
// anchored so the dot sits OUTSIDE_SHIFT_PX inside the edge on each
// clamped axis (src/map/outsideMarker.ts), and the line's last 40 percent
// is five polylines whose dots fade toward the visitor.

import { metresToFeet, metresToMiles } from "../lib/units";
import { formatCount } from "../lib/number";
import { readCssVar } from "./cssVars";
import { subscribeScheme } from "../content/theme/colorScheme";
import type { MapTheme } from "./themes";
import { clampToBbox, inBox, type Bbox } from "./bounds";
import {
  CHEVRON_OFFSET_PX,
  CHEVRON_PATH,
  initialBearing,
  outsideShift,
} from "./outsideMarker";

type UserPalette = {
  fill: string;
  stroke: string;
};

function readUserPalette(): UserPalette | null {
  const fill = readCssVar("--link");
  const stroke = readCssVar("--text-bright");
  if (fill === null || stroke === null) return null;
  return { fill, stroke };
}

const ONE_MILE_M = 1609.344;

// The outside icon's square side: room for the dot and its chevron at
// any bearing.
const OUTSIDE_ICON_PX = 40;
// Where the line starts to fade, as a share of its length from Santa, and
// the dots' fill opacity on each equal step after it.
const FADE_START = 0.6;
const FADE_STEPS = [0.8, 0.6, 0.45, 0.3, 0.15];

export function formatDistanceMetres(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "";
  if (m < ONE_MILE_M) {
    const feet = Math.round(metresToFeet(m));
    return `${formatCount(feet)} ft`;
  }
  const miles = metresToMiles(m);
  const rounded = Math.round(miles * 100) / 100;
  // Under a thousand miles this is the exact two-decimal reading; past it
  // the shared abbreviation takes over like everywhere else.
  if (rounded >= 1000) return `${formatCount(rounded)} mi`;
  return `${rounded.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
}

export type UserLocationState = {
  enabled: boolean;
  position: google.maps.LatLngLiteral | null;
  error: GeolocationPositionError["code"] | null;
  distanceMetres: number | null;
  // True only when a box is given and the fix lies outside it.
  outside: boolean;
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
  bbox: Bbox | null = null,
): UserLocation {
  let theme = initialTheme;

  // Where a position is drawn: on the box edge when it lies outside.
  function drawn(p: google.maps.LatLngLiteral): google.maps.LatLngLiteral {
    return bbox === null ? p : clampToBbox(p, bbox);
  }

  let santa: google.maps.LatLngLiteral | null = null;
  let state: UserLocationState = {
    enabled: false,
    position: null,
    error: null,
    distanceMetres: null,
    outside: false,
  };
  let userMarker: google.maps.Marker | null = null;
  let lines: google.maps.Polyline[] = [];
  let watchId: number | null = null;
  let pulseTimer: number | null = null;
  let visible = true;
  let destroyed = false;

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

  function markerIcon(): google.maps.Symbol | google.maps.Icon | null {
    const palette = readUserPalette();
    if (palette === null) return null;
    if (state.outside && state.position !== null && bbox !== null) {
      return outsideIcon(palette, state.position, bbox);
    }
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: palette.fill,
      fillOpacity: 1,
      strokeColor: palette.stroke,
      strokeWeight: 2,
    };
  }

  // The dot and its chevron in one image, so one marker still pulses. The
  // dot is at the image's centre; the anchor moves it inward on each
  // clamped axis.
  function outsideIcon(palette: UserPalette, at: google.maps.LatLngLiteral, box: Bbox): google.maps.Icon {
    const c = OUTSIDE_ICON_PX / 2;
    const shift = outsideShift(at, box);
    const rotate = Math.round(initialBearing(drawn(at), at) * 10) / 10;
    const paint = `fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2"`;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${OUTSIDE_ICON_PX}" height="${OUTSIDE_ICON_PX}" viewBox="0 0 ${OUTSIDE_ICON_PX} ${OUTSIDE_ICON_PX}">` +
      `<path d="${CHEVRON_PATH}" transform="translate(${c} ${c}) rotate(${rotate}) translate(0 ${-CHEVRON_OFFSET_PX})" stroke-linejoin="round" ${paint}/>` +
      `<circle cx="${c}" cy="${c}" r="8" ${paint}/>` +
      `</svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      size: new google.maps.Size(OUTSIDE_ICON_PX, OUTSIDE_ICON_PX),
      anchor: new google.maps.Point(c - shift.x, c - shift.y),
    };
  }

  function ensureMarker() {
    if (state.position === null) return;
    const icon = markerIcon();
    if (icon === null) return;
    if (userMarker === null) {
      userMarker = new libs.marker.Marker({
        map,
        icon,
        position: drawn(state.position),
      });
    } else {
      userMarker.setIcon(icon);
      userMarker.setPosition(drawn(state.position));
      if (userMarker.getMap() === null) userMarker.setMap(map);
    }
    if (pulseTimer === null && typeof window !== "undefined") {
      pulseTimer = window.setInterval(() => {
        if (userMarker === null) return;
        visible = !visible;
        userMarker.setVisible(visible);
      }, 600);
    }
  }

  function refreshMarkerIcon() {
    if (userMarker === null) return;
    const icon = markerIcon();
    if (icon === null) {
      userMarker.setMap(null);
      return;
    }
    userMarker.setIcon(icon);
    if (userMarker.getMap() === null) userMarker.setMap(map);
  }

  function dots(fillOpacity: number): google.maps.IconSequence[] {
    return [
      {
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 2,
          fillColor: theme.overlay.routeColor,
          fillOpacity,
          strokeColor: theme.overlay.routeColor,
        },
        offset: "0",
        repeat: "10px",
      },
    ];
  }

  // One segment from Santa to the visitor inside the box; outside it, the
  // first FADE_START of the length as one segment and the rest split
  // evenly into one segment per FADE_STEPS entry.
  function segments(): { path: google.maps.LatLngLiteral[]; fillOpacity: number }[] {
    if (state.position === null || santa === null) return [];
    const from = drawn(santa);
    const to = drawn(state.position);
    if (!state.outside) return [{ path: [from, to], fillOpacity: 1 }];
    const at = (f: number): google.maps.LatLngLiteral =>
      f >= 1 ? to : libs.geometry.spherical.interpolate(from, to, f).toJSON();
    const step = (1 - FADE_START) / FADE_STEPS.length;
    const out = [{ path: [from, at(FADE_START)], fillOpacity: 1 }];
    FADE_STEPS.forEach((fillOpacity, i) => {
      const end = i === FADE_STEPS.length - 1 ? 1 : FADE_START + (i + 1) * step;
      out.push({ path: [at(FADE_START + i * step), at(end)], fillOpacity });
    });
    return out;
  }

  function clearLines() {
    for (const l of lines) l.setMap(null);
    lines = [];
  }

  function redrawLine() {
    const segs = segments();
    if (segs.length !== lines.length) {
      clearLines();
      lines = segs.map(
        (seg) =>
          new libs.maps.Polyline({ map, path: seg.path, strokeOpacity: 0, icons: dots(seg.fillOpacity) }),
      );
      return;
    }
    segs.forEach((seg, i) => {
      lines[i].setPath(seg.path);
      lines[i].setOptions({ icons: dots(seg.fillOpacity) });
    });
  }

  const unsubscribeScheme = subscribeScheme(refreshMarkerIcon);

  function publish() {
    if (destroyed) return;
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
    clearLines();
    if (pulseTimer !== null && typeof window !== "undefined") {
      window.clearInterval(pulseTimer);
      pulseTimer = null;
    }
    visible = true;
  }

  function onFix(pos: GeolocationPosition) {
    if (destroyed) return;
    const position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    state = {
      enabled: true,
      position,
      error: null,
      distanceMetres: null,
      outside: bbox !== null && !inBox(position, bbox),
    };
    ensureMarker();
    redrawLine();
    publish();
  }

  function onError(err: GeolocationPositionError) {
    if (destroyed) return;
    state = { enabled: false, position: null, error: err.code, distanceMetres: null, outside: false };
    removeMarker();
    onChange(state);
  }

  async function enable() {
    if (destroyed) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      state = {
        enabled: false,
        position: null,
        error: 2 as GeolocationPositionError["code"],
        distanceMetres: null,
        outside: false,
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
        if (destroyed) return;
        if (status.state === "denied") {
          state = {
            enabled: false,
            position: null,
            error: 1 as GeolocationPositionError["code"],
            distanceMetres: null,
            outside: false,
          };
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

  function disable() {
    if (destroyed) return;
    clearWatch();
    removeMarker();
    state = { enabled: false, position: null, error: null, distanceMetres: null, outside: false };
    onChange(state);
  }

  function setTheme(t: MapTheme) {
    if (destroyed) return;
    theme = t;
    refreshMarkerIcon();
    redrawLine();
  }

  function setSanta(pos: google.maps.LatLngLiteral | null) {
    if (destroyed) return;
    santa = pos;
    redrawLine();
    publish();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    unsubscribeScheme();
    clearWatch();
    removeMarker();
  }

  return { enable, disable, setTheme, setSanta, getState: () => state, destroy };
}
