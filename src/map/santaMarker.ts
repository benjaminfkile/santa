// docs/site.md sections 8.2 and 8.7. Santa marker: hidden while waiting
// for a fix, anchored bottom-centre at `live.lat/lng` while tracking,
// swapped to the signal-lost icon variant when a fix has gone stale.

import type { LiveState } from "../store/liveState";

export type MarkerVariant = "tracking" | "signalLost";

function svgDataUri(variant: MarkerVariant): string {
  const fill = variant === "signalLost" ? "#9ca3af" : "#c9452e";
  const stroke = variant === "signalLost" ? "#4b5563" : "#7a2317";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">` +
    `<path d="M20 4c9 0 15 6 15 15 0 10-9 18-15 30-6-12-15-20-15-30 0-9 6-15 15-15z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>` +
    `<circle cx="20" cy="19" r="6" fill="#fff"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
      anchor: new google.maps.Point(20, 52),
    },
    optimized: false,
    clickable: false,
  });

  function apply() {
    if (position === null) {
      marker.setMap(null);
      return;
    }
    marker.setIcon({ url: svgDataUri(variant), anchor: new google.maps.Point(20, 52) });
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
