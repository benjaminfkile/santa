// docs/site.md sections 8.7 and 8.9. The legacy Santa pin, one bundled
// asset (`santa-pin.png`, 100 x 192 with the transparent padding trimmed
// and the pin tip at the bottom centre) shared by the tracker's Santa
// marker and the route map's pin. The source is sharp to about 64 css px
// tall, so both maps draw it smaller and it stays crisp at retina. The
// tracker's Santa marker on both renderers is `createSantaPinElement`: the
// image upright with a heading indicator around its tip.

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

// The heading indicator's ring, about 34 css px across, centred on the pin
// tip.
export const HEADING_RING_SIZE = 34;
export const HEADING_TRANSITION_MS = 300;
const HALO = "rgba(0, 0, 0, 0.45)";
const SVG_NS = "http://www.w3.org/2000/svg";

// Degrees from `a` to `b` the short way around, in [-180, 180).
export function shortestDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

// Degrees in whole numbers over [0, 360).
function wholeDegrees(deg: number): number {
  return Math.round(((deg % 360) + 360) % 360) % 360;
}

// The indicator's colour for a theme: the route arrows' colour, else the
// chrome accent.
export function santaHeadingColor(theme: Pick<MapTheme, "overlay" | "chrome">): string {
  return theme.overlay.arrowColor || theme.chrome.accent;
}

export type SantaPinElement = {
  // The wrapper, the image's size, its bottom centre the pin tip.
  element: HTMLDivElement;
  // The upright pin image, the only part the signal-lost filter touches.
  image: HTMLImageElement;
  // Turns the chevron the short way to the heading as seen on a map
  // turned `bearingDeg` from north; null hides the indicator where it
  // stands.
  setHeading(headingDeg: number | null, bearingDeg?: number): void;
  setColor(color: string): void;
};

// A wrapper `div` holding the upright pin image and, under it, the heading
// indicator: an SVG ring with a chevron on it, centred on the pin tip, a
// dark halo under the theme coloured stroke. The chevron points at the
// heading on the map as it is turned by turning the SVG about its centre
// to the heading minus the map's bearing (`transform: rotate()` with a
// 300 ms transition); the rotation is kept unwrapped and stepped by
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

  const half = HEADING_RING_SIZE / 2;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("data-testid", "santa-heading");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", String(HEADING_RING_SIZE));
  svg.setAttribute("height", String(HEADING_RING_SIZE));
  svg.setAttribute("viewBox", `${-half} ${-half} ${HEADING_RING_SIZE} ${HEADING_RING_SIZE}`);
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
  style.transform = "rotate(0deg)";
  style.transition = `transform ${HEADING_TRANSITION_MS}ms ease-out, opacity ${HEADING_TRANSITION_MS}ms ease-out`;

  // The ring and, at its top (north before the turn), the chevron pointing
  // out: once as the halo, once in the colour.
  const shapes = (stroke: string, width: number) => {
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("r", "10");
    const chevron = document.createElementNS(SVG_NS, "path");
    chevron.setAttribute("d", "M -5 -10.5 L 0 -15 L 5 -10.5");
    for (const s of [ring, chevron]) {
      s.setAttribute("stroke", stroke);
      s.setAttribute("stroke-width", String(width));
      svg.appendChild(s);
    }
    return [ring, chevron];
  };
  shapes(HALO, 4);
  const coloured = shapes(color, 2);

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
      for (const s of coloured) s.setAttribute("stroke", next);
    },
  };
}
