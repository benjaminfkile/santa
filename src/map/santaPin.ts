// docs/site.md sections 8.7 and 8.9. The legacy Santa pin, one bundled
// asset (`santa-pin.png`, 100 x 192 with the transparent padding trimmed
// and the pin tip at the bottom centre) shared by the tracker's Santa
// marker and the route map's pin. The source is sharp to about 64 css px
// tall, so both maps draw it smaller and it stays crisp at retina. The
// tracker's Santa marker on both renderers is `createSantaPinElement`: the
// image upright with a heading beam from its tip.

import santaPinUrl from "./santa-pin.png";
import type { MapTheme } from "./themes";

export const SANTA_PIN_URL: string = santaPinUrl;

const SOURCE_WIDTH = 100;
const SOURCE_HEIGHT = 192;

// An `img` of the pin `height` css px tall at the source's aspect,
// decorative (empty alt, `aria-hidden`), never a pointer target.
export function createSantaPinImage(height: number): HTMLImageElement {
  const img = document.createElement("img");
  img.src = SANTA_PIN_URL;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.draggable = false;
  img.decoding = "async";
  img.style.display = "block";
  img.style.height = `${height}px`;
  img.style.width = `${Math.round((height * SOURCE_WIDTH * 100) / SOURCE_HEIGHT) / 100}px`;
  img.style.pointerEvents = "none";
  return img;
}

// The heading indicator's beam: a wedge from the pin tip BEAM_SPREAD
// degrees wide (half each side of the heading) and BEAM_LENGTH css px
// long, drawn in an SVG BEAM_BOX css px square centred on the tip.
export const BEAM_SPREAD = 64;
export const BEAM_LENGTH = 56;
export const BEAM_BOX = 120;
export const HEADING_TRANSITION_MS = 300;
const HALO = "rgba(0, 0, 0, 0.45)";
const SVG_NS = "http://www.w3.org/2000/svg";

// Gives each beam's gradient its own id, so two pins on one page never
// share one.
let beamCount = 0;

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

export type SantaPinElement = {
  // The wrapper, the image's size, its bottom centre the pin tip.
  element: HTMLDivElement;
  // The upright pin image, the only part the signal-lost filter touches.
  image: HTMLImageElement;
  // Turns the beam the short way to the heading as seen on a map
  // turned `bearingDeg` from north; null hides the indicator where it
  // stands.
  setHeading(headingDeg: number | null, bearingDeg?: number): void;
  setColor(color: string): void;
};

// A wrapper `div` holding the upright pin image and, under it, the heading
// indicator: an SVG beam from the pin tip, a wedge filled with a radial
// gradient of the colour (0.55 alpha at the tip to 0.08 at the arc), its
// two edges and arc stroked in the colour over a dark halo. The SVG is
// centred on the tip with the tip as its origin; the beam points at the
// heading on the map as it is turned by turning the SVG about the tip to
// the heading minus the map's bearing (`transform: rotate()` with a 300 ms
// transition); the rotation is kept unwrapped and stepped by
// `shortestDelta`, so every turn is the short way. The image never
// rotates. The SVG carries `data-testid="santa-heading"`, `data-heading`,
// the true heading in whole degrees, and `data-bearing`, the bearing in
// whole degrees (both absent while the heading is null, when its opacity
// is 0). Nothing in it is a pointer target.
export function createSantaPinElement(height: number, color: string): SantaPinElement {
  const image = createSantaPinImage(height);
  image.style.position = "relative";
  const element = document.createElement("div");
  element.style.position = "relative";
  element.style.width = image.style.width;
  element.style.height = `${height}px`;
  element.style.pointerEvents = "none";

  const half = BEAM_BOX / 2;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("data-testid", "santa-heading");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", String(BEAM_BOX));
  svg.setAttribute("height", String(BEAM_BOX));
  svg.setAttribute("viewBox", `${-half} ${-half} ${BEAM_BOX} ${BEAM_BOX}`);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const style = svg.style;
  style.position = "absolute";
  style.left = `calc(50% - ${half}px)`;
  style.top = `${height - half}px`;
  style.overflow = "visible";
  style.pointerEvents = "none";
  style.opacity = "0";
  style.transformOrigin = "50% 50%";
  style.transform = "rotate(0deg)";
  style.transition = `transform ${HEADING_TRANSITION_MS}ms ease-out, opacity ${HEADING_TRANSITION_MS}ms ease-out`;

  // The gradient: the colour from the tip out to the arc.
  beamCount += 1;
  const gradientId = `santa-beam-${beamCount}`;
  const defs = document.createElementNS(SVG_NS, "defs");
  const gradient = document.createElementNS(SVG_NS, "radialGradient");
  gradient.setAttribute("id", gradientId);
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.setAttribute("cx", "0");
  gradient.setAttribute("cy", "0");
  gradient.setAttribute("r", String(BEAM_LENGTH));
  const stops = [
    ["0", "0.55"],
    ["1", "0.08"],
  ].map(([offset, opacity]) => {
    const stop = document.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    stop.setAttribute("stop-opacity", opacity);
    gradient.appendChild(stop);
    return stop;
  });
  defs.appendChild(gradient);
  svg.appendChild(defs);

  // The wedge, north before the turn: the tip, the left edge, the arc, the
  // right edge. Once filled, once stroked as the halo, once stroked in the
  // colour.
  const side = (BEAM_SPREAD / 2) * (Math.PI / 180);
  const x = Math.round(BEAM_LENGTH * Math.sin(side) * 100) / 100;
  const y = Math.round(BEAM_LENGTH * Math.cos(side) * 100) / 100;
  const d = `M 0 0 L ${-x} ${-y} A ${BEAM_LENGTH} ${BEAM_LENGTH} 0 0 1 ${x} ${-y} Z`;
  const wedge = (attrs: Record<string, string>) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    for (const [k, v] of Object.entries(attrs)) path.setAttribute(k, v);
    svg.appendChild(path);
    return path;
  };
  wedge({ fill: `url(#${gradientId})` });
  wedge({ stroke: HALO, "stroke-width": "3" });
  const edge = wedge({ stroke: color, "stroke-width": "1.5" });

  element.append(svg, image);

  let rotation = 0;
  let shown = false;

  return {
    element,
    image,
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
    setColor(next) {
      for (const stop of stops) stop.setAttribute("stop-color", next);
      edge.setAttribute("stroke", next);
    },
  };
}
