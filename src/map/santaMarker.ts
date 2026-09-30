// docs/site.md sections 7.6, 8.2, and 8.7. Santa marker: the legacy Santa
// pin image (santaPin.ts) in a Google Maps `OverlayView`, about 52 css px
// tall, its bottom centre (the pin tip) on the fix. Hidden while waiting
// for a fix; the signal-lost variant is the same image desaturated and
// dimmed through a CSS filter. The image is theme neutral, so a colour
// scheme change does not touch it.

import type { LiveState } from "../store/liveState";
import { createSantaPinImage } from "./santaPin";

export type MarkerVariant = "tracking" | "signalLost";

export const SANTA_MARKER_HEIGHT = 52;
export const SIGNAL_LOST_FILTER = "grayscale(1) opacity(0.55)";

export type SantaMarker = {
  setPosition(pos: google.maps.LatLngLiteral | null): void;
  setVariant(v: MarkerVariant): void;
  setState(state: LiveState, pos: google.maps.LatLngLiteral | null): void;
  getPosition(): google.maps.LatLngLiteral | null;
  destroy(): void;
};

export function createSantaMarker(
  libs: { maps: google.maps.MapsLibrary },
  map: google.maps.Map,
): SantaMarker {
  let variant: MarkerVariant = "tracking";
  let position: google.maps.LatLngLiteral | null = null;

  const img = createSantaPinImage(SANTA_MARKER_HEIGHT);
  img.setAttribute("data-testid", "santa-marker");
  img.style.position = "absolute";
  // The pin tip, the image's bottom centre, sits on the overlay point.
  img.style.transform = "translate(-50%, -100%)";

  class SantaOverlay extends libs.maps.OverlayView {
    onAdd() {
      this.getPanes()?.markerLayer.appendChild(img);
    }
    draw() {
      const projection = this.getProjection();
      if (position === null || !projection) return;
      const point = projection.fromLatLngToDivPixel(position);
      if (point === null) return;
      img.style.left = `${point.x}px`;
      img.style.top = `${point.y}px`;
    }
    onRemove() {
      img.remove();
    }
  }

  const overlay = new SantaOverlay();

  function apply() {
    if (position === null) {
      if (overlay.getMap()) overlay.setMap(null);
      return;
    }
    img.style.filter = variant === "signalLost" ? SIGNAL_LOST_FILTER : "";
    img.setAttribute("data-variant", variant);
    if (overlay.getMap()) overlay.draw();
    else overlay.setMap(map);
  }

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
      overlay.setMap(null);
    },
  };
}
