// docs/site.md sections 7.6, 8.2, and 8.7. Santa marker: the studio's pin
// with a Santa hat drawn inline. The body takes the site's accent, the
// hat the `--err` token, and the brim `--text-bright`. Hidden while
// waiting for a fix; swapped to the signal-lost variant when a fix has
// gone stale. Rebuilds its icon from the tokens on every colour-scheme
// change and renders nothing until the tokens resolve.

import type { LiveState } from "../store/liveState";
import { readCssVar } from "./cssVars";
import { subscribeScheme } from "../content/theme/colorScheme";

export type MarkerVariant = "tracking" | "signalLost";

type Palette = {
  body: string;
  hat: string;
  ground: string;
  brim: string;
};

function readPalette(variant: MarkerVariant): Palette | null {
  const accent = readCssVar("--accent");
  const err = readCssVar("--err");
  const dim = readCssVar("--text-dim");
  const ground = readCssVar("--ground");
  const brim = readCssVar("--text-bright");
  if (accent === null || err === null || dim === null || ground === null || brim === null) return null;
  return {
    body: variant === "signalLost" ? dim : accent,
    hat: variant === "signalLost" ? dim : err,
    ground,
    brim,
  };
}

function pinSvg(palette: Palette): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">` +
    `<path d="M18 43s14-13 14-25A14 14 0 0 0 4 18c0 12 14 25 14 25z" fill="${palette.body}" stroke="${palette.ground}" stroke-width="1.5"/>` +
    `<circle cx="18" cy="18" r="5.5" fill="${palette.ground}"/>` +
    `<path d="M6 10c3-8 14-11 22-6l-2 3H8z" fill="${palette.hat}" stroke="${palette.ground}" stroke-width="1"/>` +
    `<circle cx="27.5" cy="4" r="2.5" fill="${palette.brim}"/>` +
    `<rect x="5" y="8" width="24" height="3.5" rx="1.75" fill="${palette.brim}"/>` +
    `</svg>`
  );
}

function svgDataUri(palette: Palette): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(pinSvg(palette))}`;
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
    optimized: false,
    clickable: false,
  });

  function apply() {
    if (position === null) {
      marker.setMap(null);
      return;
    }
    const palette = readPalette(variant);
    if (palette === null) {
      marker.setMap(null);
      return;
    }
    marker.setIcon({ url: svgDataUri(palette), anchor: new google.maps.Point(18, 44) });
    marker.setPosition(position);
    if (marker.getMap() === null) marker.setMap(map);
  }

  const unsubscribe = subscribeScheme(apply);

  apply();

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
      unsubscribe();
      marker.setMap(null);
    },
  };
}
