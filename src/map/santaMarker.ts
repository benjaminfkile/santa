// docs/site.md sections 7.6, 8.2, and 8.7. Santa marker: the pin element
// of santaPin.ts (the legacy pin image upright, about 52 css px tall, with
// the heading indicator around its tip) in a Google Maps `OverlayView`,
// the wrapper's bottom centre (the pin tip) on the fix, rounded to whole
// pixels on every draw. Hidden while waiting for a fix; the signal-lost
// variant is the same image desaturated and dimmed through a CSS filter on
// the image only. `setHeading` turns the indicator the short way to the
// heading and null hides it; the image never rotates. `setTheme` recolours
// the indicator.

import type { LiveState } from "../store/liveState";
import type { MapTheme } from "./themes";
import { createSantaPinElement, santaHeadingColor } from "./santaPin";

export type MarkerVariant = "tracking" | "signalLost";

export const SANTA_MARKER_HEIGHT = 52;
export const SIGNAL_LOST_FILTER = "grayscale(1) opacity(0.55)";

export type SantaMarker = {
  setPosition(pos: google.maps.LatLngLiteral | null): void;
  setVariant(v: MarkerVariant): void;
  setState(state: LiveState, pos: google.maps.LatLngLiteral | null): void;
  setHeading(headingDeg: number | null): void;
  setTheme(theme: MapTheme): void;
  getPosition(): google.maps.LatLngLiteral | null;
  destroy(): void;
};

export function createSantaMarker(
  libs: { maps: google.maps.MapsLibrary },
  map: google.maps.Map,
  theme: MapTheme,
): SantaMarker {
  let variant: MarkerVariant = "tracking";
  let position: google.maps.LatLngLiteral | null = null;

  const pin = createSantaPinElement(SANTA_MARKER_HEIGHT, santaHeadingColor(theme));
  const el = pin.element;
  el.setAttribute("data-testid", "santa-marker");
  el.style.position = "absolute";
  // The pin tip, the wrapper's bottom centre, sits on the overlay point.
  el.style.transform = "translate(-50%, -100%)";

  class SantaOverlay extends libs.maps.OverlayView {
    onAdd() {
      this.getPanes()?.markerLayer.appendChild(el);
    }
    draw() {
      const projection = this.getProjection();
      if (position === null || !projection) return;
      const point = projection.fromLatLngToDivPixel(position);
      if (point === null) return;
      el.style.left = `${Math.round(point.x)}px`;
      el.style.top = `${Math.round(point.y)}px`;
    }
    onRemove() {
      el.remove();
    }
  }

  const overlay = new SantaOverlay();

  function apply() {
    if (position === null) {
      if (overlay.getMap()) overlay.setMap(null);
      return;
    }
    pin.image.style.filter = variant === "signalLost" ? SIGNAL_LOST_FILTER : "";
    el.setAttribute("data-variant", variant);
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
    setHeading(headingDeg) {
      pin.setHeading(headingDeg);
    },
    setTheme(t) {
      pin.setColor(santaHeadingColor(t));
    },
    getPosition() {
      return position;
    },
    destroy() {
      overlay.setMap(null);
    },
  };
}
