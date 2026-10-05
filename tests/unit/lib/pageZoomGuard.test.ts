// docs/site.md section 7.6. The page zoom guard cancels a pinch whose
// target is page-owned and leaves the map canvas's own pinch alone.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installPageZoomGuard } from "../../../src/lib/pageZoomGuard";

function touchMove(target: Element, touchCount: number): Event {
  const event = new Event("touchmove", { cancelable: true, bubbles: true });
  Object.defineProperty(event, "touches", { value: { length: touchCount } });
  target.dispatchEvent(event);
  return event;
}

function gestureStart(target: Element): Event {
  const event = new Event("gesturestart", { cancelable: true, bubbles: true });
  target.dispatchEvent(event);
  return event;
}

let plain: HTMLElement;
let onCanvas: HTMLElement;
let onOverlay: HTMLElement;
let uninstall: (() => void) | null = null;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="plain"></div>
    <div data-map-canvas="">
      <div id="on-canvas"></div>
      <div data-map-overlay=""><button id="on-overlay"></button></div>
    </div>`;
  plain = document.getElementById("plain")!;
  onCanvas = document.getElementById("on-canvas")!;
  onOverlay = document.getElementById("on-overlay")!;
  uninstall = installPageZoomGuard(document);
});

afterEach(() => {
  uninstall?.();
  uninstall = null;
  document.body.innerHTML = "";
});

describe("installPageZoomGuard", () => {
  it("prevents a two-touch move on a plain element", () => {
    expect(touchMove(plain, 2).defaultPrevented).toBe(true);
  });

  it("leaves a one-touch move alone", () => {
    expect(touchMove(plain, 1).defaultPrevented).toBe(false);
  });

  it("leaves a two-touch move inside the map canvas alone", () => {
    expect(touchMove(onCanvas, 2).defaultPrevented).toBe(false);
  });

  it("prevents a two-touch move on a map overlay inside the canvas", () => {
    expect(touchMove(onOverlay, 2).defaultPrevented).toBe(true);
  });

  it("prevents gesturestart on the body", () => {
    expect(gestureStart(document.body).defaultPrevented).toBe(true);
  });

  it("prevents nothing after the cleanup", () => {
    uninstall?.();
    uninstall = null;
    expect(touchMove(plain, 2).defaultPrevented).toBe(false);
    expect(touchMove(onOverlay, 2).defaultPrevented).toBe(false);
    expect(touchMove(onCanvas, 2).defaultPrevented).toBe(false);
    expect(gestureStart(document.body).defaultPrevented).toBe(false);
  });
});
