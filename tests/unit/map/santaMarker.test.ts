// docs/site.md sections 7.6, 8.2, and 8.7. The Santa marker is the legacy
// pin image in an OverlayView, its tip (bottom centre) on the fix; the
// signal-lost variant is the same image under a CSS filter; nothing
// renders while waiting for a fix.

import { describe, it, expect, beforeEach } from "vitest";
import { createSantaMarker, SIGNAL_LOST_FILTER } from "../../../src/map/santaMarker";
import { SANTA_PIN_URL } from "../../../src/map/santaPin";

class FakeOverlayView {
  static instances: FakeOverlayView[] = [];
  map: unknown = null;
  panes = { markerLayer: document.createElement("div") };
  draws = 0;
  constructor() {
    FakeOverlayView.instances.push(this);
  }
  onAdd?(): void;
  draw?(): void;
  onRemove?(): void;
  getPanes() {
    return this.panes;
  }
  getProjection() {
    return {
      fromLatLngToDivPixel: (p: google.maps.LatLngLiteral) => ({ x: p.lng * 10, y: p.lat * 10 }),
    };
  }
  getMap() {
    return this.map;
  }
  setMap(map: unknown) {
    if (map === this.map) return;
    if (this.map !== null) this.onRemove?.();
    this.map = map;
    if (map !== null) {
      this.onAdd?.();
      this.draw?.();
    }
  }
}

const map = { name: "map" } as unknown as google.maps.Map;
const libs = { maps: { OverlayView: FakeOverlayView } } as unknown as { maps: google.maps.MapsLibrary };

function overlay(): FakeOverlayView {
  return FakeOverlayView.instances[0];
}

function pin(): HTMLImageElement | null {
  return overlay().panes.markerLayer.querySelector("img");
}

beforeEach(() => {
  FakeOverlayView.instances = [];
});

describe("createSantaMarker", () => {
  it("starts detached from the map (waiting for a fix)", () => {
    const santa = createSantaMarker(libs, map);
    santa.setState("waitingForFix", { lat: 40, lng: -105 });
    expect(overlay().map).toBe(null);
    expect(pin()).toBe(null);
  });

  it("renders the bundled pin image with its tip on the fix", () => {
    const santa = createSantaMarker(libs, map);
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(overlay().map).toBe(map);
    const img = pin()!;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe(SANTA_PIN_URL);
    expect(img.style.height).toBe("52px");
    expect(img.style.position).toBe("absolute");
    expect(img.style.transform).toBe("translate(-50%, -100%)");
    expect(img.style.left).toBe("-1100px");
    expect(img.style.top).toBe("410px");
    expect(img.style.filter).toBe("");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("aria-hidden")).toBe("true");
  });

  it("moves the image when a new fix arrives", () => {
    const santa = createSantaMarker(libs, map);
    santa.setState("tracking", { lat: 41, lng: -110 });
    santa.setState("tracking", { lat: 42, lng: -111 });
    expect(pin()!.style.left).toBe("-1110px");
    expect(pin()!.style.top).toBe("420px");
    expect(santa.getPosition()).toEqual({ lat: 42, lng: -111 });
  });

  it("keeps the last position and desaturates the same image on signalLost", () => {
    const santa = createSantaMarker(libs, map);
    santa.setState("tracking", { lat: 41, lng: -110 });
    santa.setState("signalLost", null);
    expect(overlay().map).toBe(map);
    expect(santa.getPosition()).toEqual({ lat: 41, lng: -110 });
    const img = pin()!;
    expect(img.getAttribute("src")).toBe(SANTA_PIN_URL);
    expect(img.style.filter).toBe(SIGNAL_LOST_FILTER);
    expect(SIGNAL_LOST_FILTER).toContain("grayscale");
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(pin()!.style.filter).toBe("");
  });

  it("hides the marker again when waitingForFix returns", () => {
    const santa = createSantaMarker(libs, map);
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(overlay().map).toBe(map);
    santa.setState("waitingForFix", null);
    expect(overlay().map).toBe(null);
    expect(pin()).toBe(null);
    expect(santa.getPosition()).toBe(null);
  });

  it("detaches on destroy", () => {
    const santa = createSantaMarker(libs, map);
    santa.setState("tracking", { lat: 41, lng: -110 });
    santa.destroy();
    expect(overlay().map).toBe(null);
  });
});
