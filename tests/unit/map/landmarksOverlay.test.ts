// docs/site.md section 8.5. The landmarks overlay builds one element per
// landmark, a badge holding the icon when one is set and the accent dot
// otherwise, with the name beside it; a click on a badge opens the popover
// with the name, the description, and the directions link in the popover
// host, placed from the point's container pixel and moved on every draw;
// Escape and a press elsewhere close it; the overlays leave the map below
// zoom 10 and while the toggle is off; below zoom 12 every element carries
// data-name="hidden" and the popover still opens on a click.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createLandmarksOverlay,
  LANDMARKS_MIN_ZOOM,
  NAME_MIN_ZOOM,
  POPOVER_GAP,
  type MountIcon,
} from "../../../src/map/landmarksOverlay";
import { FakeMap, FakeOverlayView, fakeLibs, installFakeGoogle, resetFakeGoogle } from "./fakeGoogle";

const landmarks = [
  {
    name: "Town Hall",
    lat: 40,
    lng: -105,
    icon: { source: "library" as const, id: "star" },
    description: "Where the parade starts.",
  },
  { name: "Fire Station", lat: 41, lng: -106 },
];

function setup() {
  const map = new FakeMap(document.createElement("div"), { zoom: 12 });
  const unmount = vi.fn();
  const mountIcon = vi.fn<MountIcon>((container) => {
    container.appendChild(document.createElement("svg"));
    return unmount;
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const overlay = createLandmarksOverlay(
    fakeLibs(),
    map as unknown as google.maps.Map,
    landmarks,
    mountIcon,
    host,
  );
  const pane = map.panes.overlayMouseTarget;
  document.body.appendChild(pane);
  return { map, overlay, pane, host, mountIcon, unmount };
}

beforeEach(() => {
  installFakeGoogle();
  resetFakeGoogle();
  document.body.innerHTML = "";
});

describe("createLandmarksOverlay", () => {
  it("builds one element per landmark: the icon badge when set, the dot otherwise, and the name", async () => {
    const { overlay, pane, mountIcon } = setup();
    overlay.update({ visible: true, zoom: 12 });
    await Promise.resolve();
    const elements = pane.querySelectorAll('[data-testid="tracker-landmark"]');
    expect(elements).toHaveLength(2);
    expect(mountIcon).toHaveBeenCalledTimes(1);
    expect(mountIcon.mock.calls[0][1]).toEqual({ source: "library", id: "star" });
    expect(elements[0].querySelector('[data-testid="tracker-landmark-icon"]')).not.toBeNull();
    expect(elements[0].querySelector('[data-testid="tracker-landmark-dot"]')).toBeNull();
    expect(elements[1].querySelector('[data-testid="tracker-landmark-icon"]')).toBeNull();
    expect(elements[1].querySelector('[data-testid="tracker-landmark-dot"]')).not.toBeNull();
    expect(elements[0].textContent).toContain("Town Hall");
    expect(elements[1].textContent).toContain("Fire Station");
    expect((elements[0] as HTMLElement).style.left).toBe("-1050px");
    expect((elements[0] as HTMLElement).style.top).toBe("400px");
    expect(elements[1].querySelector("button")?.getAttribute("aria-label")).toBe("About Fire Station");
  });

  it("opens the popover on click with the name, the description, and the directions link", async () => {
    const { overlay, pane, host } = setup();
    overlay.update({ visible: true, zoom: 12 });
    await Promise.resolve();
    const badge = pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')!;
    badge.click();
    expect(pane.querySelector('[data-testid="tracker-landmark-popover"]')).toBeNull();
    const popover = host.querySelector('[data-testid="tracker-landmark-popover"]')!;
    expect(popover).not.toBeNull();
    expect(popover.parentElement).toBe(host);
    expect(badge.getAttribute("aria-expanded")).toBe("true");
    expect(popover.querySelector("h3")?.textContent).toBe("Town Hall");
    expect(popover.textContent).toContain("Where the parade starts.");
    const link = popover.querySelector<HTMLAnchorElement>('[data-testid="tracker-landmark-directions"]')!;
    expect(link.textContent).toBe("Get directions");
    expect(link.getAttribute("href")).toBe("https://www.google.com/maps/dir/?api=1&destination=40,-105");
    expect(link.getAttribute("target")).toBe("_blank");

    // One popover at a time: the second badge replaces the first.
    const second = pane.querySelectorAll<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')[1];
    second.click();
    const popovers = host.querySelectorAll('[data-testid="tracker-landmark-popover"]');
    expect(popovers).toHaveLength(1);
    expect(popovers[0].querySelector("h3")?.textContent).toBe("Fire Station");
    expect(badge.getAttribute("aria-expanded")).toBe("false");
  });

  it("places the popover from the point's container pixel above the badge and moves it on every draw", async () => {
    const { overlay, pane, host } = setup();
    overlay.update({ visible: true, zoom: 12 });
    await Promise.resolve();
    pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')!.click();
    const popover = host.querySelector<HTMLElement>('[data-testid="tracker-landmark-popover"]')!;
    expect(popover.style.left).toBe("-1050px");
    expect(popover.style.top).toBe(`${400 - POPOVER_GAP}px`);

    // The map pans: Google calls draw again with a new projection.
    FakeOverlayView.shift = { x: 1200, y: 30 };
    for (const view of FakeOverlayView.instances) view.draw?.();
    expect(popover.style.left).toBe("150px");
    expect(popover.style.top).toBe(`${430 - POPOVER_GAP}px`);
  });

  it("closes the popover on Escape and on a press elsewhere", async () => {
    const { overlay, pane, host } = setup();
    overlay.update({ visible: true, zoom: 12 });
    await Promise.resolve();
    const badge = pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')!;
    badge.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(host.querySelector('[data-testid="tracker-landmark-popover"]')).toBeNull();
    expect(document.activeElement).toBe(badge);

    badge.click();
    const popover = host.querySelector('[data-testid="tracker-landmark-popover"]')!;
    popover.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(host.querySelector('[data-testid="tracker-landmark-popover"]')).not.toBeNull();
    badge.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(host.querySelector('[data-testid="tracker-landmark-popover"]')).not.toBeNull();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(host.querySelector('[data-testid="tracker-landmark-popover"]')).toBeNull();
  });

  it("keeps the popover inside the host's width when both have a width", async () => {
    const { overlay, pane, host } = setup();
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 400 });
    overlay.update({ visible: true, zoom: 12 });
    await Promise.resolve();
    const badge = pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')!;
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 200 });
    try {
      badge.click();
      const popover = host.querySelector<HTMLElement>('[data-testid="tracker-landmark-popover"]')!;
      // The point is far left of the host: the popover's left edge stops 8 px in.
      expect(popover.style.left).toBe("108px");
      FakeOverlayView.shift = { x: 2000, y: 0 };
      for (const view of FakeOverlayView.instances) view.draw?.();
      expect(popover.style.left).toBe("292px");
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, "offsetWidth", original);
    }
  });

  it("leaves the map below zoom 10 and while the toggle is off", async () => {
    const { overlay, pane } = setup();
    overlay.update({ visible: true, zoom: LANDMARKS_MIN_ZOOM - 1 });
    await Promise.resolve();
    expect(pane.querySelectorAll('[data-testid="tracker-landmark"]')).toHaveLength(0);
    overlay.update({ visible: true, zoom: LANDMARKS_MIN_ZOOM });
    await Promise.resolve();
    expect(pane.querySelectorAll('[data-testid="tracker-landmark"]')).toHaveLength(2);
    overlay.update({ visible: false, zoom: 14 });
    expect(pane.querySelectorAll('[data-testid="tracker-landmark"]')).toHaveLength(0);
  });

  it("marks the names hidden below zoom 12 and shown from 12, and still opens the popover at 11", async () => {
    const { overlay, pane, host } = setup();
    expect(NAME_MIN_ZOOM).toBe(12);
    overlay.update({ visible: true, zoom: 11 });
    await Promise.resolve();
    const elements = Array.from(pane.querySelectorAll('[data-testid="tracker-landmark"]'));
    expect(elements).toHaveLength(2);
    for (const e of elements) expect(e.getAttribute("data-name")).toBe("hidden");
    pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')!.click();
    expect(host.querySelector('[data-testid="tracker-landmark-popover"] h3')?.textContent).toBe("Town Hall");
    overlay.update({ visible: true, zoom: 12 });
    for (const e of elements) expect(e.getAttribute("data-name")).toBe("shown");
  });

  it("destroy detaches every element, removes the open popover from the host, and unmounts the icons", async () => {
    const { overlay, pane, host, unmount } = setup();
    overlay.update({ visible: true, zoom: 12 });
    await Promise.resolve();
    pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')!.click();
    expect(host.querySelector('[data-testid="tracker-landmark-popover"]')).not.toBeNull();
    overlay.destroy();
    expect(host.querySelector('[data-testid="tracker-landmark-popover"]')).toBeNull();
    expect(pane.querySelectorAll('[data-testid="tracker-landmark"]')).toHaveLength(0);
    expect(unmount).toHaveBeenCalledTimes(1);
  });
});
