// docs/site.md sections 8.2 and 8.9. Route mode on Google: the route
// preview drawn with Google primitives from the same options the MapLibre
// host takes, behind the same handle shape (`update`, `refit`, `destroy`,
// and the names state on the container), so the section does not know the
// renderer.
//  - The path is a geodesic `Polyline` in the theme's `overlay.routeColor`
//    at `overlay.routeOpacity`, ROUTE_WEIGHT px wide times the route width
//    scale. With `arrows` it also carries `FORWARD_OPEN_ARROW` symbols
//    tinted `overlay.arrowColor`, repeated every ARROW_SPACING px and
//    ARROW_SCALE large, both times the arrow scale, as the MapLibre arrow
//    layer spaces and sizes its arrowheads.
//  - Each timeline mark is a small circle symbol filled in `chrome.bg` and
//    stroked in the route colour; the end of the path is a larger circle
//    filled in `chrome.text` and ringed in `chrome.bg`.
//  - Each time label is a dot marker in the route colour, titled with the
//    label (the native tooltip), and a label marker beside it: the elapsed
//    text in `overlay.timeLabelFg` on `overlay.timeLabelBg`, its font size
//    times the label scale. The label markers are on the map only at
//    `labelMinZoom` and above.
//  - Each viewpoint is a dot marker in `chrome.fg` ringed in `chrome.bg`
//    (none for a `badge` viewpoint, whose element the caller builds) and a
//    name label beside it under the same zoom rule, further out for a
//    badge. A click on the dot or the name calls `onViewpointClick` with
//    the viewpoint's point.
//  - `startElement` stands on the path's first point, anchored at its
//    bottom centre, and each `viewpointMarkers` element on its point,
//    centred, both in an `OverlayView` on the overlay mouse target pane.
//  - `terrain` picks the `terrain` map type, else `roadmap`.
//  - The map is restricted to the event box, its least zoom the zoom that
//    fits the box (recomputed on resize). The camera fits the path's
//    bounds with FIT_PADDING px of padding (less on a very small frame) on
//    mount and on every resize, the bounds clamped to the box only where
//    they leave it. A new path refits; a same path does not.
//  - `styles` is the theme's array with the place filter of `poiKinds` on
//    top (absent hides every kind).

import type {
  LatLng,
  TimeLabel,
  Viewpoint,
  ViewpointMarker,
} from "../mapHost/handle";
import type { MapsLibs } from "./loadMaps";
import type { MapTheme } from "./themes";
import { poiStyles } from "./poiStyles";
import { fittedMinZoom, MIN_ZOOM_FLOOR, type Bbox } from "./bounds";

// A Google theme as the route map draws it: its fetched style array and
// the palettes the overlay paints with.
export type GoogleRouteTheme = Pick<MapTheme, "key" | "overlay" | "chrome"> & {
  style: google.maps.MapTypeStyle[];
};

export type GoogleRouteUpdate = {
  theme: GoogleRouteTheme;
  path: readonly LatLng[];
  marks?: readonly LatLng[];
  terrain?: boolean;
  timeLabels?: readonly TimeLabel[];
  poiKinds?: readonly string[] | null;
  viewpoints?: readonly Viewpoint[];
  viewpointMarkers?: readonly ViewpointMarker[];
  arrows?: boolean;
  arrowScale?: number;
  routeWidthScale?: number;
  labelScale?: number;
  labelMinZoom?: number;
};

export type GoogleRouteOptions = GoogleRouteUpdate & {
  bbox: Bbox | null;
  startElement?: HTMLElement;
  onViewpointClick?: (point: { lat: number; lng: number }) => void;
};

export type GoogleRouteHandle = {
  update: (next: GoogleRouteUpdate) => void;
  refit: () => void;
  destroy: () => void;
};

export const FIT_PADDING = 40;
// The route line width in px at a route width scale of 1.
export const ROUTE_WEIGHT = 4;
// Pixels between arrowheads along the line, and the symbol scale, at an
// arrow scale of 1.
export const ARROW_SPACING = 140;
export const ARROW_SCALE = 2.5;
// The circle symbol scales: the marks, the end, the time label dots, and
// the viewpoint dots (the last two times the label scale).
const MARK_SCALE = 3;
const END_SCALE = 6;
const TIME_DOT_SCALE = 4;
const VIEWPOINT_DOT_SCALE = 3.5;
// The label font sizes in px at a label scale of 1.
export const TIME_LABEL_FONT = 14;
export const VIEWPOINT_FONT = 12;
// How far a label starts from its point, in px: beside a dot, and beside
// a badge (about 28 px across).
const LABEL_GAP = 8;
const BADGE_LABEL_GAP = 18;
// The zoom the map opens at before the path is fitted.
const OPEN_ZOOM = 10;

type State = ReturnType<typeof stateOf>;

function stateOf(next: GoogleRouteUpdate) {
  return {
    theme: next.theme,
    path: next.path,
    marks: next.marks ?? [],
    terrain: next.terrain ?? false,
    timeLabels: next.timeLabels ?? [],
    poiKinds: next.poiKinds ?? null,
    viewpoints: next.viewpoints ?? [],
    viewpointMarkers: next.viewpointMarkers ?? [],
    arrows: next.arrows ?? false,
    arrowScale: scaleOf(next.arrowScale),
    routeWidthScale: scaleOf(next.routeWidthScale),
    labelScale: scaleOf(next.labelScale),
    labelMinZoom: next.labelMinZoom,
  };
}

function scaleOf(value: number | undefined): number {
  return value !== undefined && value > 0 ? value : 1;
}

function samePoints(a: readonly LatLng[], b: readonly LatLng[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((p, i) => p.lat === b[i].lat && p.lng === b[i].lng);
}

function sameLabelled(
  a: readonly (LatLng & { label: string; badge?: boolean })[],
  b: readonly (LatLng & { label: string; badge?: boolean })[],
): boolean {
  return samePoints(a, b) && a.every((p, i) => p.label === b[i].label && p.badge === b[i].badge);
}

function sameMarkers(a: readonly ViewpointMarker[], b: readonly ViewpointMarker[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((m, i) => m.element === b[i].element && m.lat === b[i].lat && m.lng === b[i].lng);
}

function sameTheme(a: GoogleRouteTheme, b: GoogleRouteTheme): boolean {
  return (
    a.key === b.key &&
    a.style === b.style &&
    JSON.stringify(a.overlay) === JSON.stringify(b.overlay) &&
    JSON.stringify(a.chrome) === JSON.stringify(b.chrome)
  );
}

function sameKinds(a: readonly string[] | null, b: readonly string[] | null): boolean {
  if (a === b) return true;
  if (a === null || b === null || a.length !== b.length) return false;
  return a.every((kind, i) => kind === b[i]);
}

// Whether the drawn overlay (everything but the HTML elements, the map
// type, and the label zoom) says the same thing.
function sameDrawing(a: State, b: State): boolean {
  return (
    sameTheme(a.theme, b.theme) &&
    samePoints(a.path, b.path) &&
    samePoints(a.marks, b.marks) &&
    sameLabelled(a.timeLabels, b.timeLabels) &&
    sameLabelled(a.viewpoints, b.viewpoints) &&
    a.arrows === b.arrows &&
    a.arrowScale === b.arrowScale &&
    a.routeWidthScale === b.routeWidthScale &&
    a.labelScale === b.labelScale
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A label icon: `text` in `fg` on a rounded `bg` box at `opacity`, the
// font `fontSize` px; its width is estimated from the text length.
export function labelIcon(
  text: string,
  fg: string,
  bg: string,
  opacity: number,
  fontSize: number,
): { url: string; width: number; height: number } {
  const height = Math.round(fontSize * 1.7);
  const width = Math.round(text.length * fontSize * 0.6 + fontSize);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" rx="${height / 2}" ry="${height / 2}" fill="${escapeXml(bg)}" fill-opacity="${opacity}"/>` +
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="central" fill="${escapeXml(fg)}" font-family="system-ui, sans-serif" font-weight="500" font-size="${fontSize}">${escapeXml(text)}</text>` +
    `</svg>`;
  return { url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, width, height };
}

function circle(
  scale: number,
  fillColor: string,
  strokeColor: string,
  strokeWeight: number,
  fillOpacity = 1,
): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor,
    fillOpacity,
    strokeColor,
    strokeWeight,
  };
}

type ElementOverlay = google.maps.OverlayView & { moveTo(point: LatLng): void };

export function mountGoogleRoute(
  libs: MapsLibs,
  container: HTMLElement,
  options: GoogleRouteOptions,
): GoogleRouteHandle {
  const { bbox } = options;
  let state = stateOf(options);
  let disposed = false;

  function viewport() {
    return { width: container.clientWidth, height: container.clientHeight };
  }

  function minZoom(): number {
    return bbox === null ? MIN_ZOOM_FLOOR : fittedMinZoom(bbox, viewport());
  }

  function styles(): google.maps.MapTypeStyle[] {
    return poiStyles(state.theme.style, { kinds: state.poiKinds ?? [] });
  }

  function padding(): number {
    const { width, height } = viewport();
    return Math.max(0, Math.min(FIT_PADDING, Math.floor(Math.min(width, height) / 4)));
  }

  // The path's bounds as [south west, north east], clamped to the event
  // box where they leave it; null for an empty path.
  function fitCorners(): [LatLng, LatLng] | null {
    const path = state.path;
    if (path.length === 0) return null;
    let south = path[0].lat;
    let north = path[0].lat;
    let west = path[0].lng;
    let east = path[0].lng;
    for (const p of path) {
      south = Math.min(south, p.lat);
      north = Math.max(north, p.lat);
      west = Math.min(west, p.lng);
      east = Math.max(east, p.lng);
    }
    if (bbox !== null && !(west >= bbox.west && south >= bbox.south && east <= bbox.east && north <= bbox.north)) {
      const lng = (v: number) => Math.min(bbox.east, Math.max(bbox.west, v));
      const lat = (v: number) => Math.min(bbox.north, Math.max(bbox.south, v));
      return [{ lat: lat(south), lng: lng(west) }, { lat: lat(north), lng: lng(east) }];
    }
    return [{ lat: south, lng: west }, { lat: north, lng: east }];
  }

  const opening = fitCorners();
  const map = new libs.maps.Map(container, {
    center: opening === null
      ? bbox === null
        ? { lat: 0, lng: 0 }
        : { lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 }
      : { lat: (opening[0].lat + opening[1].lat) / 2, lng: (opening[0].lng + opening[1].lng) / 2 },
    zoom: OPEN_ZOOM,
    ...(bbox !== null ? { restriction: { latLngBounds: bbox, strictBounds: true } } : {}),
    minZoom: minZoom(),
    mapTypeId: state.terrain ? "terrain" : "roadmap",
    disableDefaultUI: true,
    gestureHandling: "greedy",
    clickableIcons: false,
    keyboardShortcuts: true,
    styles: styles(),
  });

  function fit(): void {
    const corners = fitCorners();
    if (corners === null) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(corners[0]);
    bounds.extend(corners[1]);
    map.fitBounds(bounds, padding());
  }

  let lastMinZoom = minZoom();
  function refit(): void {
    if (disposed) return;
    const next = minZoom();
    if (next !== lastMinZoom) {
      lastMinZoom = next;
      map.setOptions({ minZoom: next });
    }
    fit();
  }

  function zoom(): number {
    return map.getZoom() ?? OPEN_ZOOM;
  }

  function namesHidden(): boolean {
    return state.labelMinZoom !== undefined && zoom() < state.labelMinZoom;
  }

  // The drawn overlay: the path, the marks, the end, the dots, and the
  // labels (on the map only while the names show).
  let drawn: (google.maps.Polyline | google.maps.Marker)[] = [];
  let labels: google.maps.Marker[] = [];
  let labelsOn = false;

  function clearDrawing(): void {
    for (const item of drawn) item.setMap(null);
    for (const label of labels) label.setMap(null);
    drawn = [];
    labels = [];
  }

  function showLabels(): void {
    container.setAttribute("data-names", namesHidden() ? "hidden" : "shown");
    const on = !namesHidden();
    if (on === labelsOn) return;
    labelsOn = on;
    for (const label of labels) label.setMap(on ? map : null);
  }

  function marker(opts: google.maps.MarkerOptions): google.maps.Marker {
    const m = new libs.marker.Marker({ map, ...opts });
    drawn.push(m);
    return m;
  }

  function label(
    point: LatLng,
    text: string,
    fg: string,
    bg: string,
    opacity: number,
    fontSize: number,
    gap: number,
    zIndex: number,
    clickable: boolean,
  ): google.maps.Marker {
    const icon = labelIcon(text, fg, bg, opacity, fontSize);
    const m = new libs.marker.Marker({
      position: { lat: point.lat, lng: point.lng },
      map: labelsOn ? map : null,
      icon: {
        url: icon.url,
        scaledSize: new google.maps.Size(icon.width, icon.height),
        anchor: new google.maps.Point(-gap, icon.height / 2),
      },
      clickable,
      zIndex,
    });
    labels.push(m);
    return m;
  }

  function draw(): void {
    clearDrawing();
    const { overlay, chrome } = state.theme;
    const routeColor = overlay.routeColor;
    labelsOn = !namesHidden();
    drawn.push(
      new libs.maps.Polyline({
        path: state.path.map((p) => ({ lat: p.lat, lng: p.lng })),
        map,
        geodesic: true,
        clickable: false,
        strokeColor: routeColor,
        strokeOpacity: overlay.routeOpacity,
        strokeWeight: ROUTE_WEIGHT * state.routeWidthScale,
        icons: state.arrows
          ? [
              {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
                  scale: ARROW_SCALE * state.arrowScale,
                  strokeColor: overlay.arrowColor,
                  strokeOpacity: overlay.routeOpacity,
                  strokeWeight: 2,
                },
                offset: `${(ARROW_SPACING * state.arrowScale) / 2}px`,
                repeat: `${ARROW_SPACING * state.arrowScale}px`,
              },
            ]
          : [],
      }),
    );
    for (const p of state.marks) {
      marker({
        position: { lat: p.lat, lng: p.lng },
        icon: circle(MARK_SCALE, chrome.bg, routeColor, 2, 0.9),
        clickable: false,
        zIndex: 1,
      });
    }
    const end = state.path[state.path.length - 1];
    if (end !== undefined) {
      marker({
        position: { lat: end.lat, lng: end.lng },
        icon: circle(END_SCALE, chrome.text, chrome.bg, 2),
        clickable: false,
        zIndex: 2,
      });
    }
    for (const v of state.viewpoints) {
      const point = { lat: v.lat, lng: v.lng };
      const click = () => {
        if (!disposed) options.onViewpointClick?.(point);
      };
      if (v.badge !== true) {
        marker({
          position: point,
          icon: circle(VIEWPOINT_DOT_SCALE * state.labelScale, chrome.fg, chrome.bg, 1),
          title: v.label,
          clickable: true,
          zIndex: 3,
        }).addListener("click", click);
      }
      const name = label(
        point,
        v.label,
        overlay.timeLabelFg,
        overlay.timeLabelBg,
        overlay.timeLabelOpacity,
        VIEWPOINT_FONT * state.labelScale,
        v.badge === true ? BADGE_LABEL_GAP : LABEL_GAP,
        3,
        true,
      );
      name.addListener("click", click);
    }
    for (const t of state.timeLabels) {
      marker({
        position: { lat: t.lat, lng: t.lng },
        icon: circle(TIME_DOT_SCALE * state.labelScale, routeColor, chrome.bg, 1.5),
        title: t.label,
        clickable: false,
        zIndex: 4,
      });
      label(
        t,
        t.label,
        overlay.timeLabelFg,
        overlay.timeLabelBg,
        overlay.timeLabelOpacity,
        TIME_LABEL_FONT * state.labelScale,
        LABEL_GAP,
        4,
        false,
      );
    }
    showLabels();
  }

  // An HTML element on a point, in the overlay mouse target pane, its
  // bottom centre (`bottom`) or its centre on the point.
  function elementOverlay(element: HTMLElement, point: LatLng, anchor: "bottom" | "center"): ElementOverlay {
    const holder = document.createElement("div");
    holder.style.position = "absolute";
    holder.style.transform = anchor === "bottom" ? "translate(-50%, -100%)" : "translate(-50%, -50%)";
    holder.appendChild(element);
    let at = point;
    class Overlay extends libs.maps.OverlayView {
      onAdd() {
        libs.maps.OverlayView.preventMapHitsAndGesturesFrom(holder);
        this.getPanes()?.overlayMouseTarget.appendChild(holder);
      }
      draw() {
        const pixel = this.getProjection()?.fromLatLngToDivPixel(at);
        if (!pixel) return;
        holder.style.left = `${pixel.x}px`;
        holder.style.top = `${pixel.y}px`;
      }
      onRemove() {
        holder.remove();
      }
      moveTo(next: LatLng) {
        at = next;
        this.draw();
      }
    }
    const overlay = new Overlay();
    overlay.setMap(map);
    return overlay;
  }

  const startPoint = state.path[0];
  const start =
    options.startElement === undefined || startPoint === undefined
      ? null
      : elementOverlay(options.startElement, startPoint, "bottom");

  let pins: ElementOverlay[] = [];
  let pinned: readonly ViewpointMarker[] = [];
  function placePins(next: readonly ViewpointMarker[]): void {
    if (sameMarkers(pinned, next)) return;
    for (const pin of pins) pin.setMap(null);
    pinned = next;
    pins = next.map(({ lat, lng, element }) => elementOverlay(element, { lat, lng }, "center"));
  }

  draw();
  placePins(state.viewpointMarkers);
  fit();

  const listeners = [map.addListener("zoom_changed", () => {
    if (!disposed) showLabels();
  })];

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(refit);
    observer.observe(container);
  }

  return {
    update(update) {
      if (disposed) return;
      const next = stateOf(update);
      const previous = state;
      state = next;
      placePins(next.viewpointMarkers);
      if (!sameTheme(previous.theme, next.theme) || !sameKinds(previous.poiKinds, next.poiKinds)) {
        map.setOptions({ styles: styles() });
      }
      if (previous.terrain !== next.terrain) map.setMapTypeId(next.terrain ? "terrain" : "roadmap");
      if (!sameDrawing(previous, next)) draw();
      else if (previous.labelMinZoom !== next.labelMinZoom) showLabels();
      if (!samePoints(previous.path, next.path)) {
        const first = next.path[0];
        if (first !== undefined) start?.moveTo(first);
        fit();
      }
    },
    refit,
    destroy() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      observer = null;
      for (const l of listeners) l.remove();
      clearDrawing();
      start?.setMap(null);
      for (const pin of pins) pin.setMap(null);
      pins = [];
    },
  };
}
