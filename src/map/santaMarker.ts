// docs/site.md sections 7.6, 8.2, and 8.7. Santa marker: the studio's pin
// with a Santa hat drawn inline. The body takes the site's accent, the
// hat the `--err` token, and the brim white. Hidden while waiting for a
// fix; swapped to the signal-lost variant when a fix has gone stale.

import type { LiveState } from "../store/liveState";
import { readCssVar } from "./cssVars";

export type MarkerVariant = "tracking" | "signalLost";

function pinSvg(variant: MarkerVariant): string {
  const accent = readCssVar("--accent", "#0b6bb5");
  const hat = variant === "signalLost" ? readCssVar("--text-dim", "#5a6885") : readCssVar("--err", "#c2362c");
  const body = variant === "signalLost" ? readCssVar("--text-dim", "#5a6885") : accent;
  const ground = readCssVar("--ground", "#eef3fa");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">` +
    `<path d="M18 43s14-13 14-25A14 14 0 0 0 4 18c0 12 14 25 14 25z" fill="${body}" stroke="${ground}" stroke-width="1.5"/>` +
    `<circle cx="18" cy="18" r="5.5" fill="${ground}"/>` +
    `<path d="M6 10c3-8 14-11 22-6l-2 3H8z" fill="${hat}" stroke="${ground}" stroke-width="1"/>` +
    `<circle cx="27.5" cy="4" r="2.5" fill="#ffffff"/>` +
    `<rect x="5" y="8" width="24" height="3.5" rx="1.75" fill="#ffffff"/>` +
    `</svg>`
  );
}

function svgDataUri(variant: MarkerVariant): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(pinSvg(variant))}`;
}

export type SantaMarker = {
  setPosition(pos: google.maps.LatLngLiteral | null): void;
  setVariant(v: MarkerVariant): void;
  setState(state: LiveState, pos: google.maps.LatLngLiteral | null): void;
  getPosition(): google.maps.LatLngLiteral | null;
  destroy(): void;
};

export function createSantaMarker(
  libs: { marker: google.maps.MarkerLibrary },
  map: google.maps.Map,
): SantaMarker {
  let variant: MarkerVariant = "tracking";
  let position: google.maps.LatLngLiteral | null = null;
  const marker = new libs.marker.Marker({
    map: null,
    position: null as unknown as google.maps.LatLngLiteral,
    icon: {
      url: svgDataUri(variant),
      anchor: new google.maps.Point(18, 44),
    },
    optimized: false,
    clickable: false,
  });

  function apply() {
    if (position === null) {
      marker.setMap(null);
      return;
    }
    marker.setIcon({ url: svgDataUri(variant), anchor: new google.maps.Point(18, 44) });
    marker.setPosition(position);
    if (marker.getMap() === null) marker.setMap(map);
  }

  return {
    setPosition(pos) {
      position = pos;
      apply();
    },
    setVariant(v) {
      variant = v;
      apply();
    },
    setState(state, pos) {
      if (state === "waitingForFix") {
        position = null;
        apply();
        return;
      }
      variant = state === "signalLost" ? "signalLost" : "tracking";
      if (pos !== null) position = pos;
      apply();
    },
    getPosition() {
      return position;
    },
    destroy() {
      marker.setMap(null);
    },
  };
}
