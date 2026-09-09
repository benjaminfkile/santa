// docs/site.md section 8.3. Owns the `google.maps.Map`, the Santa marker,
// the route overlay, and the user location. Subscribes to the store once
// and moves the marker imperatively; React never re-renders on a fix.

import type { Route } from "../contracts";
import type { LiveState } from "../store/liveState";
import { createSantaMarker, type SantaMarker } from "./santaMarker";
import { createRouteOverlay, type RouteOverlay } from "./routeOverlay";
import { createUserLocation, type UserLocation, type UserLocationState } from "./userLocation";
import type { MapsLibs } from "./loadMaps";
import type { MapTheme } from "./themes";

export type MapControllerOptions = {
  theme: MapTheme;
  defaultCenter: google.maps.LatLngLiteral;
  defaultZoom: number;
  showSantaMarker: boolean;
  showUserLocation: boolean;
  onFollowChange?: (following: boolean) => void;
  onUserLocationChange?: (s: UserLocationState) => void;
};

export type MapController = {
  map: google.maps.Map;
  setTheme(theme: MapTheme): void;
  setMapType(type: "terrain" | "roadmap"): void;
  setRoute(route: Route | null): void;
  setToggles(t: { routeLines: boolean; timeLabels: boolean }): void;
  setLiveFix(
    state: LiveState,
    pos: google.maps.LatLngLiteral | null,
    seqChanged: boolean,
  ): void;
  follow(on: boolean): void;
  recenter(pos: google.maps.LatLngLiteral | null): void;
  zoomBy(delta: number): void;
  fitRoute(): void;
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
  let route: Route | null = null;
  let toggles = { routeLines: true, timeLabels: true };
  let following = true;
  let santa: SantaMarker | null = null;
  let overlay: RouteOverlay;
  let userLoc: UserLocation | null = null;
  let zoomDebounce: number | null = null;

  const map = new libs.maps.Map(container, {
    center: opts.defaultCenter,
    zoom: opts.defaultZoom,
    minZoom: 5,
    mapTypeId: "terrain",
    disableDefaultUI: true,
    gestureHandling: "greedy",
    clickableIcons: false,
    keyboardShortcuts: true,
    styles: theme.styles,
  });

  overlay = createRouteOverlay(libs, map, null);

  if (opts.showSantaMarker) {
    santa = createSantaMarker(libs, map);
  }

  if (opts.showUserLocation) {
    userLoc = createUserLocation(libs, map, theme, (s) => {
      opts.onUserLocationChange?.(s);
    });
  }

  map.addListener("dragstart", () => {
    if (following) {
      following = false;
      opts.onFollowChange?.(false);
    }
  });

  map.addListener("zoom_changed", () => {
    if (zoomDebounce !== null) window.clearTimeout(zoomDebounce);
    zoomDebounce = window.setTimeout(() => {
      overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);
    }, 150);
  });

  overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);

  return {
    map,
    setTheme(t) {
      theme = t;
      map.setOptions({ styles: theme.styles });
      overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);
      userLoc?.setTheme(theme);
    },
    setMapType(type) {
      map.setMapTypeId(type);
    },
    setRoute(r) {
      route = r;
      overlay.destroy();
      overlay = createRouteOverlay(libs, map, route);
      overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);
    },
    setToggles(t) {
      toggles = { ...toggles, ...t };
      overlay.redraw(theme, map.getZoom() ?? opts.defaultZoom, toggles);
    },
    setLiveFix(state, pos, seqChanged) {
      santa?.setState(state, pos);
      userLoc?.setSanta(pos);
      if (following && seqChanged && pos !== null) map.panTo(pos);
    },
    follow(on) {
      following = on;
      opts.onFollowChange?.(on);
    },
    recenter(pos) {
      if (pos !== null) map.panTo(pos);
      following = true;
      opts.onFollowChange?.(true);
    },
    zoomBy(delta) {
      const z = map.getZoom() ?? opts.defaultZoom;
      map.setZoom(z + delta);
    },
    fitRoute() {
      const pts = (route?.points ?? []).filter(
        (p) => typeof p.lat === "number" && typeof p.lng === "number",
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
      overlay.destroy();
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
