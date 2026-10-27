// docs/site.md sections 8.7 and 8.10. The Santa marker shared by the
// tracker's two renderers: a circle in the theme's chrome colours under a
// red and white Santa hat drawn as inline SVG, with a heading arc on its
// rim. `createSantaPinElement` builds it; the wrapper's centre is the fix.

import type { MapTheme } from "./themes";

// The wrapper and the circle, css px square. Every other size below
// follows from it.
export const SANTA_MARKER_SIZE = 28;
const RADIUS = SANTA_MARKER_SIZE / 2;
const RING_WIDTH = 3;
// The heading arc: its radius (the circle's, half the ring, and a 3.5 px
// gap), its spread in degrees (half each side of the heading), its stroke
// and its halo's, all in css px, drawn in an SVG HEADING_BOX css px square
// centred on the circle.
export const ARC_RADIUS = RADIUS + RING_WIDTH / 2 + 3.5;
export const ARC_SPREAD = 50;
export const ARC_WIDTH = 3.5;
export const ARC_HALO_WIDTH = 5.5;
export const HEADING_BOX = 60;
export const HEADING_TRANSITION_MS = 300;
const HALO = "rgba(0, 0, 0, 0.45)";
const SVG_NS = "http://www.w3.org/2000/svg";

// The hat: a 91 x 63 drawing scaled to 1.15 times the circle's width,
// centred, its bottom edge a fifth of the circle's width below the
// circle's top edge so the brim sits on the circle. Its colours are fixed
// on every theme.
const HAT_BOX_WIDTH = 91;
const HAT_BOX_HEIGHT = 63;
const HAT_WIDTH = SANTA_MARKER_SIZE * 1.15;
const HAT_SCALE = HAT_WIDTH / HAT_BOX_WIDTH;
const HAT_LEFT = -HAT_WIDTH / 2;
const HAT_TOP = -RADIUS + SANTA_MARKER_SIZE * 0.2 - HAT_BOX_HEIGHT * HAT_SCALE;
const px = (n: number, places: number) => String(Math.round(n * 10 ** places) / 10 ** places);
const HAT_TRANSFORM = `translate(${px(HAT_LEFT, 2)} ${px(HAT_TOP, 2)}) scale(${px(HAT_SCALE, 4)})`;
const HAT_SHAPES: ReadonlyArray<[string, Record<string, string>]> = [
  // The cone.
  ["path", { d: "M 8 50 C 12 30, 24 12, 44 6 C 56 3, 68 6, 76 12 C 80 15, 82 18, 80 21 C 74 14, 64 12, 56 16 C 68 26, 76 38, 78 50 Z", fill: "#d8262b" }],
  // Its highlight.
  ["path", { d: "M 8 50 C 12 30, 24 12, 44 6 C 50 5, 56 5, 62 6 C 50 10, 36 22, 30 50 Z", fill: "#ffffff", "fill-opacity": "0.12" }],
  // The brim.
  ["rect", { x: "3", y: "46", width: "85", height: "16", rx: "8", fill: "#ffffff", stroke: "#d6d6d6", "stroke-width": "0.8" }],
  // The pom.
  ["circle", { cx: "80", cy: "17", r: "7.5", fill: "#ffffff", stroke: "#d6d6d6", "stroke-width": "0.8" }],
];

export type SantaMarkerColors = { fill: string; ring: string; heading: string };

// Degrees from `a` to `b` the short way around, in [-180, 180).
export function shortestDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

// Degrees in whole numbers over [0, 360).
function wholeDegrees(deg: number): number {
  return Math.round(((deg % 360) + 360) % 360) % 360;
}

// The indicator's colour for a theme: its heading colour, else the route
// arrows' colour, else the chrome accent (the fallbacks for a theme row
// without a heading colour).
export function santaHeadingColor(theme: Pick<MapTheme, "overlay" | "chrome">): string {
  return theme.overlay.headingColor || theme.overlay.arrowColor || theme.chrome.accent;
}

// The marker's colours for a theme: the circle filled in the chrome
// background and ringed in the chrome accent, the arc in the heading
// colour. The fallbacks serve a theme row with an empty chrome field.
export function santaMarkerColors(theme: Pick<MapTheme, "overlay" | "chrome">): SantaMarkerColors {
  const heading = santaHeadingColor(theme);
  return { fill: theme.chrome.bg || "#ffffff", ring: theme.chrome.accent || heading, heading };
}

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export type SantaPinElement = {
  // The wrapper, SANTA_MARKER_SIZE css px square, its centre the fix.
  element: HTMLDivElement;
  // The circle and the hat, the only part the signal-lost filter touches.
  body: SVGSVGElement;
  // Turns the arc the short way to the heading as seen on a map turned
  // `bearingDeg` from north; null hides the indicator where it stands.
  setHeading(headingDeg: number | null, bearingDeg?: number): void;
  // Recolours the circle's fill and ring and the arc.
  setColors(colors: SantaMarkerColors): void;
};

// A wrapper `div` holding, first, the body: an SVG with a circle of
// RADIUS at its centre in the fill colour, stroked 3 px in the ring colour,
// under the Santa hat. Then the heading indicator: an SVG centred on the
// circle holding one arc of ARC_RADIUS spanning ARC_SPREAD degrees centred
// on north before the turn, stroked once as a dark halo and once in the
// heading colour, above the body and the hat. The arc points at the
// heading on the map as it is turned by turning its SVG about the centre
// to the heading minus the map's bearing (`transform: rotate()` with a
// 300 ms transition); the rotation is kept unwrapped and stepped by
// `shortestDelta`, so every turn is the short way. The body never
// rotates. The indicator carries `data-testid="santa-heading"`,
// `data-heading`, the true heading in whole degrees, and `data-bearing`,
// the bearing in whole degrees (both absent while the heading is null,
// when its opacity is 0). Nothing in it is a pointer target.
export function createSantaPinElement(colors: SantaMarkerColors): SantaPinElement {
  const element = document.createElement("div");
  element.style.position = "relative";
  element.style.width = `${SANTA_MARKER_SIZE}px`;
  element.style.height = `${SANTA_MARKER_SIZE}px`;
  element.style.pointerEvents = "none";

  // The body: the circle, then the hat over it.
  const body = svgElement("svg", {
    "data-testid": "santa-body",
    "aria-hidden": "true",
    width: String(SANTA_MARKER_SIZE),
    height: String(SANTA_MARKER_SIZE),
    viewBox: `${-RADIUS} ${-RADIUS} ${SANTA_MARKER_SIZE} ${SANTA_MARKER_SIZE}`,
  });
  body.style.display = "block";
  body.style.overflow = "visible";
  body.style.pointerEvents = "none";
  const circle = svgElement("circle", {
    cx: "0",
    cy: "0",
    r: String(RADIUS),
    fill: colors.fill,
    stroke: colors.ring,
    "stroke-width": String(RING_WIDTH),
  });
  circle.style.filter = "drop-shadow(0 1.5px 2.5px rgba(0, 0, 0, 0.4))";
  const hat = svgElement("g", { transform: HAT_TRANSFORM });
  hat.style.filter = "drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.3))";
  for (const [tag, attrs] of HAT_SHAPES) hat.appendChild(svgElement(tag as "path", attrs));
  body.append(circle, hat);

  // The heading indicator, centred on the circle.
  const half = HEADING_BOX / 2;
  const svg = svgElement("svg", {
    "data-testid": "santa-heading",
    "aria-hidden": "true",
    width: String(HEADING_BOX),
    height: String(HEADING_BOX),
    viewBox: `${-half} ${-half} ${HEADING_BOX} ${HEADING_BOX}`,
    fill: "none",
    "stroke-linecap": "round",
  });
  const style = svg.style;
  style.position = "absolute";
  style.left = `${RADIUS - half}px`;
  style.top = `${RADIUS - half}px`;
  style.overflow = "visible";
  style.pointerEvents = "none";
  style.opacity = "0";
  style.transformOrigin = "50% 50%";
  style.transform = "rotate(0deg)";
  style.transition = `transform ${HEADING_TRANSITION_MS}ms ease-out, opacity ${HEADING_TRANSITION_MS}ms ease-out`;

  // The arc, north before the turn, from ARC_SPREAD / 2 degrees left of
  // north to as many right: once as the halo, once in the colour.
  const side = (ARC_SPREAD / 2) * (Math.PI / 180);
  const x = Math.round(ARC_RADIUS * Math.sin(side) * 100) / 100;
  const y = Math.round(ARC_RADIUS * Math.cos(side) * 100) / 100;
  const d = `M ${-x} ${-y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${x} ${-y}`;
  const arc = svgElement("path", { d, stroke: colors.heading, "stroke-width": String(ARC_WIDTH) });
  svg.append(svgElement("path", { d, stroke: HALO, "stroke-width": String(ARC_HALO_WIDTH) }), arc);

  element.append(body, svg);

  let rotation = 0;
  let shown = false;

  return {
    element,
    body,
    setHeading(headingDeg, bearingDeg = 0) {
      if (headingDeg === null) {
        if (!shown) return;
        shown = false;
        style.opacity = "0";
        svg.removeAttribute("data-heading");
        svg.removeAttribute("data-bearing");
        return;
      }
      if (!shown) {
        shown = true;
        style.opacity = "1";
      }
      svg.setAttribute("data-heading", String(wholeDegrees(headingDeg)));
      svg.setAttribute("data-bearing", String(wholeDegrees(bearingDeg)));
      const turn = headingDeg - bearingDeg;
      const next = Math.round((rotation + shortestDelta(rotation, turn)) * 100) / 100;
      if (next === rotation) return;
      rotation = next;
      style.transform = `rotate(${rotation}deg)`;
    },
    setColors(next) {
      circle.setAttribute("fill", next.fill);
      circle.setAttribute("stroke", next.ring);
      arc.setAttribute("stroke", next.heading);
    },
  };
}
