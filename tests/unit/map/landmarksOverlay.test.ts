// docs/site.md section 8.5. The landmarks overlay builds one element per
// landmark, a badge holding the icon when one is set and the accent dot
// otherwise, with the name beside it; a click on a badge opens the popover
// with the name, the description, and the directions link; Escape and a
// press elsewhere close it; the overlays leave the map below zoom 10 and
// while the toggle is off.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createLandmarksOverlay, LANDMARKS_MIN_ZOOM, type MountIcon } from "../../../src/map/landmarksOverlay";
import { FakeMap, fakeLibs, installFakeGoogle, resetFakeGoogle } from "./fakeGoogle";

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
  const overlay = createLandmarksOverlay(
    fakeLibs(),
    map as unknown as google.maps.Map,
    landmarks,
    mountIcon,
  );
  const pane = map.panes.overlayMouseTarget;
  document.body.appendChild(pane);
  return { map, overlay, pane, mountIcon, unmount };
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
    const { overlay, pane } = setup();
    overlay.update({ visible: true, zoom: 12 });
    await Promise.resolve();
    const badge = pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')!;
    badge.click();
    const popover = pane.querySelector('[data-testid="tracker-landmark-popover"]')!;
    expect(popover).not.toBeNull();
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
    const popovers = pane.querySelectorAll('[data-testid="tracker-landmark-popover"]');
    expect(popovers).toHaveLength(1);
    expect(popovers[0].querySelector("h3")?.textContent).toBe("Fire Station");
    expect(badge.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the popover on Escape and on a press elsewhere", async () => {
    const { overlay, pane } = setup();
    overlay.update({ visible: true, zoom: 12 });
    await Promise.resolve();
    const badge = pane.querySelector<HTMLButtonElement>('[data-testid="tracker-landmark-badge"]')!;
    badge.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(pane.querySelector('[data-testid="tracker-landmark-popover"]')).toBeNull();
    expect(document.activeElement).toBe(badge);

    badge.click();
    const popover = pane.querySelector('[data-testid="tracker-landmark-popover"]')!;
    popover.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(pane.querySelector('[data-testid="tracker-landmark-popover"]')).not.toBeNull();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(pane.querySelector('[data-testid="tracker-landmark-popover"]')).toBeNull();
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

  it("destroy detaches every element and unmounts the icons", async () => {
    const { overlay, pane, unmount } = setup();
    overlay.update({ visible: true, zoom: 12 });
    await Promise.resolve();
    overlay.destroy();
    expect(pane.querySelectorAll('[data-testid="tracker-landmark"]')).toHaveLength(0);
    expect(unmount).toHaveBeenCalledTimes(1);
  });
});
