// docs/site.md sections 7.6, 8.2, and 8.7. The Santa marker is the
// element of santaPin.ts (a circle under the Santa hat and its heading
// arc) in an OverlayView, its centre on the fix; the signal-lost variant
// is the same body under a CSS filter; nothing renders while waiting for
// a fix; the heading turns the arc, never the body, and a theme change
// recolours the fill, the ring and the arc.

import { describe, it, expect, beforeEach } from "vitest";
import { createSantaMarker, SIGNAL_LOST_FILTER } from "../../../src/map/santaMarker";
import { santaMarkerColors } from "../../../src/map/santaPin";
import { SEEDED } from "./themeFixtures";

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

function marker(): HTMLElement | null {
  return overlay().panes.markerLayer.querySelector('[data-testid="santa-marker"]');
}

function pin(): SVGSVGElement | null {
  return overlay().panes.markerLayer.querySelector('[data-testid="santa-body"]');
}

function headingRing(): SVGSVGElement | null {
  return overlay().panes.markerLayer.querySelector('[data-testid="santa-heading"]');
}

beforeEach(() => {
  FakeOverlayView.instances = [];
});

describe("createSantaMarker", () => {
  it("starts detached from the map (waiting for a fix)", () => {
    const santa = createSantaMarker(libs, map, SEEDED.standard);
    santa.setState("waitingForFix", { lat: 40, lng: -105 });
    expect(overlay().map).toBe(null);
    expect(pin()).toBe(null);
  });

  it("renders the circle under the hat with its centre on the fix", () => {
    const santa = createSantaMarker(libs, map, SEEDED.standard);
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(overlay().map).toBe(map);
    const body = pin()!;
    expect(body).not.toBeNull();
    expect(overlay().panes.markerLayer.querySelector("img")).toBeNull();
    const el = marker()!;
    expect(el.contains(body)).toBe(true);
    expect(el.style.width).toBe("36px");
    expect(el.style.height).toBe("36px");
    expect(el.style.position).toBe("absolute");
    expect(el.style.transform).toBe("translate(-50%, -50%)");
    expect(el.style.left).toBe("-1100px");
    expect(el.style.top).toBe("410px");
    expect(body.style.filter).toBe("");
    expect(body.getAttribute("aria-hidden")).toBe("true");
  });

  it("moves the marker when a new fix arrives", () => {
    const santa = createSantaMarker(libs, map, SEEDED.standard);
    santa.setState("tracking", { lat: 41, lng: -110 });
    santa.setState("tracking", { lat: 42, lng: -111 });
    expect(marker()!.style.left).toBe("-1110px");
    expect(marker()!.style.top).toBe("420px");
    expect(santa.getPosition()).toEqual({ lat: 42, lng: -111 });
  });

  it("keeps the last position and desaturates the same body on signalLost", () => {
    const santa = createSantaMarker(libs, map, SEEDED.standard);
    santa.setState("tracking", { lat: 41, lng: -110 });
    santa.setState("signalLost", null);
    expect(overlay().map).toBe(map);
    expect(santa.getPosition()).toEqual({ lat: 41, lng: -110 });
    expect(pin()!.style.filter).toBe(SIGNAL_LOST_FILTER);
    expect(SIGNAL_LOST_FILTER).toContain("grayscale");
    expect(marker()!.style.filter).toBe("");
    expect(headingRing()!.style.filter).toBe("");
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(pin()!.style.filter).toBe("");
  });

  it("turns the arc, never the body, and hides it for no heading", () => {
    const santa = createSantaMarker(libs, map, SEEDED.standard);
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(headingRing()!.style.opacity).toBe("0");
    santa.setHeading(350);
    santa.setHeading(10);
    expect(headingRing()!.style.transform).toBe("rotate(10deg)");
    expect(headingRing()!.style.opacity).toBe("1");
    expect(headingRing()!.getAttribute("data-heading")).toBe("10");
    expect(pin()!.style.transform).toBe("");
    expect(marker()!.style.transform).toBe("translate(-50%, -50%)");
    santa.setHeading(null);
    expect(headingRing()!.style.opacity).toBe("0");
  });

  it("colours the circle from the theme's chrome and the arc from its heading colour, and recolours the three on a theme change", () => {
    const santa = createSantaMarker(libs, map, SEEDED.standard);
    santa.setState("tracking", { lat: 41, lng: -110 });
    const circle = () => pin()!.querySelector(":scope > circle")!;
    const arc = () => headingRing()!.querySelectorAll("path")[1];
    expect(circle().getAttribute("fill")).toBe(SEEDED.standard.chrome.bg);
    expect(circle().getAttribute("stroke")).toBe(SEEDED.standard.chrome.accent);
    expect(arc().getAttribute("stroke")).toBe(SEEDED.standard.overlay.headingColor);
    santa.setTheme(SEEDED.charcoal);
    const next = santaMarkerColors(SEEDED.charcoal);
    expect(circle().getAttribute("fill")).toBe(next.fill);
    expect(circle().getAttribute("stroke")).toBe(next.ring);
    expect(arc().getAttribute("stroke")).toBe(SEEDED.charcoal.overlay.headingColor);
    const old = SEEDED.expedition;
    santa.setTheme({ ...old, overlay: { ...old.overlay, headingColor: "" } });
    expect(arc().getAttribute("stroke")).toBe(old.overlay.arrowColor);
  });

  it("hides the marker again when waitingForFix returns", () => {
    const santa = createSantaMarker(libs, map, SEEDED.standard);
    santa.setState("tracking", { lat: 41, lng: -110 });
    expect(overlay().map).toBe(map);
    santa.setState("waitingForFix", null);
    expect(overlay().map).toBe(null);
    expect(pin()).toBe(null);
    expect(santa.getPosition()).toBe(null);
  });

  it("detaches on destroy", () => {
    const santa = createSantaMarker(libs, map, SEEDED.standard);
    santa.setState("tracking", { lat: 41, lng: -110 });
    santa.destroy();
    expect(overlay().map).toBe(null);
  });
});
