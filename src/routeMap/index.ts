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
// screen.

import "./maplibre.css";
import { Map as MapLibreMap, addProtocol, setWorkerUrl } from "maplibre-gl";
import type { AddProtocolAction } from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { env } from "../config/env";
import type { Appearance } from "./flavors";
import { OSM_ATTRIBUTION, buildStyle, pathBounds, tilesUrl, type LatLng } from "./style";

export type { Appearance } from "./flavors";
export type { LatLng } from "./style";

export type RouteMapOptions = {
  container: HTMLElement;
  path: readonly LatLng[];
  appearance: Appearance;
  onError: (error: unknown) => void;
};

export type RouteMapHandle = {
  update: (next: { path: readonly LatLng[]; appearance: Appearance }) => void;
  destroy: () => void;
};

const FIT_PADDING = 40;

let protocol: Protocol | null = null;

function ensureProtocol(): Protocol {
  if (protocol === null) {
    setWorkerUrl(workerUrl);
    protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile as AddProtocolAction);
  }
  return protocol;
}

function samePath(a: readonly LatLng[], b: readonly LatLng[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].lat !== b[i].lat || a[i].lng !== b[i].lng) return false;
  }
  return true;
}

export async function mountRouteMap(options: RouteMapOptions): Promise<RouteMapHandle> {
  const base = env.ROUTE_BASEMAP_URL;
  if (base === "") throw new Error("VITE_ROUTE_BASEMAP_URL is not set");
  const { container, onError } = options;
  let path = options.path;
  let appearance = options.appearance;

  const proto = ensureProtocol();
  const url = tilesUrl(base);
  let archive = proto.get(url);
  if (archive === undefined) {
    archive = new PMTiles(url);
    proto.add(archive);
  }
  const header = await archive.getHeader();

  function padding(): number {
    const { clientWidth, clientHeight } = container;
    return Math.max(0, Math.min(FIT_PADDING, Math.floor(Math.min(clientWidth, clientHeight) / 4)));
  }

  const map = new MapLibreMap({
    container,
    style: buildStyle(appearance, base, path),
    bounds: pathBounds(path) ?? undefined,
    fitBoundsOptions: { padding: padding() },
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    cooperativeGestures: true,
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
  map.on("error", (event) => {
    if (settled || failed) return;
    failed = true;
    onError(event.error);
  });

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      map.resize();
      fit();
    });
    observer.observe(container);
  }

  return {
    update(next) {
      const pathChanged = !samePath(path, next.path);
      if (!pathChanged && next.appearance === appearance) return;
      path = next.path;
      appearance = next.appearance;
      map.setStyle(buildStyle(appearance, base, path), { diff: true });
      if (pathChanged) fit();
    },
    destroy() {
      observer?.disconnect();
      observer = null;
      map.remove();
    },
  };
}
