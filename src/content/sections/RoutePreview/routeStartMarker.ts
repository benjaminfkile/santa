// docs/site.md section 8.9. The route map's start marker, handed to the
// route map as its start element and anchored at its bottom centre on the
// path's first point: an inline SVG flag ROUTE_START_HEIGHT css px tall
// (a short pole in the bright text colour on a round base, a five-point
// star at the top in gold with a thin bright text stroke) and, beside
// it, a "Starts here" label in the pill recipe on the panel colour with
// a line border. The whole marker is `aria-hidden`; the map region's
// label speaks the start.

import { copy } from "../../../copy/copy";
import * as styles from "./RoutePreview.module.css";

export const ROUTE_START_HEIGHT = 36;

const SVG_NS = "http://www.w3.org/2000/svg";

const STAR_PATH =
  "M12 2 L13.94 7.33 L19.61 7.53 L15.14 11.02 L16.7 16.47 L12 13.3 L7.3 16.47 L8.86 11.02 L4.39 7.53 L10.06 7.33Z";

function svgElement(name: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

export function createRouteStartMarker(): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.routeStart;
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("data-testid", "route-map-start");

  const svg = svgElement("svg", {
    viewBox: "0 0 24 36",
    width: String((ROUTE_START_HEIGHT * 24) / 36),
    height: String(ROUTE_START_HEIGHT),
    class: styles.routeStartFlag,
    "aria-hidden": "true",
    focusable: "false",
  });
  svg.append(
    svgElement("ellipse", { cx: "12", cy: "33.5", rx: "4", ry: "1.75", fill: "currentColor" }),
    svgElement("path", {
      d: "M12 14v19",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      fill: "none",
    }),
    svgElement("path", {
      d: STAR_PATH,
      fill: "var(--gold)",
      stroke: "currentColor",
      "stroke-width": "1",
      "stroke-linejoin": "round",
    }),
  );

  const label = document.createElement("span");
  label.className = styles.routeStartLabel;
  label.textContent = copy.map.routeStart;
  label.setAttribute("data-testid", "route-map-start-label");

  el.append(svg, label);
  return el;
}
