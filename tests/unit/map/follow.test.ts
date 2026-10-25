// docs/site.md sections 8.3 and 8.10. The follow rule: a point needs a pan
// only outside the central box spanning 60 percent of each dimension (20
// percent margin on every side), never in a container with no size; a
// follow pan is due 500 ms after the last one started; the gesture watch
// calls back for a wheel, a second touch, a double tap, and a pointer
// drag past 4 px, and removes its listeners.

import { describe, it, expect, vi } from "vitest";
import {
  FOLLOW_GAP_MS,
  followEasing,
  followPanDue,
  needsPan,
  watchGestures,
} from "../../../src/map/follow";

const SIZE = { width: 400, height: 800 };

describe("needsPan", () => {
  it("is false at the middle and on every edge of the central box", () => {
    expect(needsPan({ x: 200, y: 400 }, SIZE)).toBe(false);
    expect(needsPan({ x: 80, y: 400 }, SIZE)).toBe(false);
    expect(needsPan({ x: 320, y: 400 }, SIZE)).toBe(false);
    expect(needsPan({ x: 200, y: 160 }, SIZE)).toBe(false);
    expect(needsPan({ x: 200, y: 640 }, SIZE)).toBe(false);
  });

  it("is true just past each edge", () => {
    expect(needsPan({ x: 79, y: 400 }, SIZE)).toBe(true);
    expect(needsPan({ x: 321, y: 400 }, SIZE)).toBe(true);
    expect(needsPan({ x: 200, y: 159 }, SIZE)).toBe(true);
    expect(needsPan({ x: 200, y: 641 }, SIZE)).toBe(true);
  });

  it("is true off the container and false in a container with no size", () => {
    expect(needsPan({ x: -50, y: 900 }, SIZE)).toBe(true);
    expect(needsPan({ x: -50, y: 900 }, { width: 0, height: 0 })).toBe(false);
  });
});

describe("followPanDue", () => {
  it("is due with no pan yet and FOLLOW_GAP_MS after the last one started", () => {
    expect(followPanDue(1000, null)).toBe(true);
    expect(followPanDue(1000 + FOLLOW_GAP_MS - 1, 1000)).toBe(false);
    expect(followPanDue(1000 + FOLLOW_GAP_MS, 1000)).toBe(true);
  });

  it("eases from 0 to 1", () => {
    expect(followEasing(0)).toBe(0);
    expect(followEasing(1)).toBe(1);
    expect(followEasing(0.5)).toBeGreaterThan(0.5);
  });
});

describe("watchGestures", () => {
  function pointer(el: HTMLElement, type: string, x: number, id = 1) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 0 });
    Object.defineProperty(event, "pointerId", { value: id });
    el.dispatchEvent(event);
  }

  function touchStart(el: HTMLElement, touches: number) {
    const event = new Event("touchstart", { bubbles: true });
    Object.defineProperty(event, "touches", { value: Array.from({ length: touches }, () => ({})) });
    el.dispatchEvent(event);
  }

  it("calls back for a wheel, a second touch, and a double tap, before a child sees them", () => {
    const el = document.createElement("div");
    const child = document.createElement("div");
    el.appendChild(child);
    const order: string[] = [];
    child.addEventListener("wheel", () => order.push("child"));
    watchGestures(el, () => order.push("gesture"));
    child.dispatchEvent(new Event("wheel", { bubbles: true }));
    expect(order).toEqual(["gesture", "child"]);
    touchStart(el, 1);
    expect(order).toHaveLength(2);
    touchStart(el, 2);
    el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(order).toEqual(["gesture", "child", "gesture", "gesture"]);
  });

  it("calls back for a pointer that moves past 4 px while down, once per press", () => {
    const el = document.createElement("div");
    const onGesture = vi.fn();
    watchGestures(el, onGesture);
    pointer(el, "pointermove", 50);
    pointer(el, "pointerdown", 0);
    pointer(el, "pointermove", 4);
    pointer(el, "pointerup", 4);
    pointer(el, "pointermove", 50);
    expect(onGesture).not.toHaveBeenCalled();
    pointer(el, "pointerdown", 0);
    pointer(el, "pointermove", 5);
    pointer(el, "pointermove", 20);
    expect(onGesture).toHaveBeenCalledTimes(1);
  });

  it("removes its listeners", () => {
    const el = document.createElement("div");
    const onGesture = vi.fn();
    const stop = watchGestures(el, onGesture);
    stop();
    el.dispatchEvent(new Event("wheel", { bubbles: true }));
    touchStart(el, 2);
    el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    pointer(el, "pointerdown", 0);
    pointer(el, "pointermove", 50);
    expect(onGesture).not.toHaveBeenCalled();
  });
});
