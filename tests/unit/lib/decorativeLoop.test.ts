// docs/site.md section 18. Decorative canvases cap their backing store at
// a device pixel ratio of 2, and their frame loop pauses while the tab is
// hidden or the layer is off screen and resumes when both hold again.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DECORATIVE_MAX_DPR,
  decorativeDpr,
  startDecorativeLoop,
} from "../../../src/lib/decorativeLoop";

describe("decorativeDpr", () => {
  it("caps the ratio at 2", () => {
    expect(DECORATIVE_MAX_DPR).toBe(2);
    expect(decorativeDpr(3)).toBe(2);
    expect(decorativeDpr(2.625)).toBe(2);
  });

  it("keeps ratios of 2 and under as they are", () => {
    expect(decorativeDpr(2)).toBe(2);
    expect(decorativeDpr(1.5)).toBe(1.5);
    expect(decorativeDpr(1)).toBe(1);
  });

  it("falls back to 1 for a missing or invalid ratio", () => {
    expect(decorativeDpr(0)).toBe(1);
    expect(decorativeDpr(Number.NaN)).toBe(1);
    expect(decorativeDpr(0.5)).toBe(1);
  });

  it("reads window.devicePixelRatio by default", () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
    try {
      expect(decorativeDpr()).toBe(2);
    } finally {
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: original });
    }
  });
});

describe("startDecorativeLoop", () => {
  let queue: Map<number, FrameRequestCallback>;
  let nextId: number;
  let observers: { cb: IntersectionObserverCallback; targets: Element[]; disconnected: boolean }[];
  let visibility: DocumentVisibilityState;

  function flushFrame(): void {
    const pending = [...queue.entries()];
    queue.clear();
    for (const [, cb] of pending) cb(0);
  }

  function setVisibility(v: DocumentVisibilityState): void {
    visibility = v;
    document.dispatchEvent(new Event("visibilitychange"));
  }

  function setIntersecting(isIntersecting: boolean): void {
    for (const o of observers) {
      if (o.disconnected) continue;
      o.cb(
        o.targets.map((target) => ({ target, isIntersecting }) as unknown as IntersectionObserverEntry),
        {} as IntersectionObserver,
      );
    }
  }

  beforeEach(() => {
    queue = new Map();
    nextId = 1;
    observers = [];
    visibility = "visible";
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      queue.delete(id);
    });
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    class FakeObserver {
      private readonly rec: (typeof observers)[number];
      constructor(cb: IntersectionObserverCallback) {
        this.rec = { cb, targets: [], disconnected: false };
        observers.push(this.rec);
      }
      observe(t: Element) {
        this.rec.targets.push(t);
      }
      unobserve() {}
      disconnect() {
        this.rec.disconnected = true;
      }
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("paints a first frame at once and keeps one frame scheduled", () => {
    const frame = vi.fn();
    const loop = startDecorativeLoop(document.body, frame);
    expect(frame).toHaveBeenCalledTimes(1);
    expect(loop.isRunning()).toBe(true);
    expect(queue.size).toBe(1);
    flushFrame();
    flushFrame();
    expect(frame).toHaveBeenCalledTimes(3);
    expect(queue.size).toBe(1);
    loop.stop();
  });

  it("observes its layer with IntersectionObserver", () => {
    const el = document.createElement("canvas");
    const loop = startDecorativeLoop(el, () => {});
    expect(observers).toHaveLength(1);
    expect(observers[0].targets).toEqual([el]);
    loop.stop();
    expect(observers[0].disconnected).toBe(true);
  });

  it("pauses while the document is hidden and resumes when it is shown", () => {
    const frame = vi.fn();
    const loop = startDecorativeLoop(document.body, frame);
    setVisibility("hidden");
    expect(loop.isRunning()).toBe(false);
    expect(queue.size).toBe(0);
    flushFrame();
    expect(frame).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    expect(loop.isRunning()).toBe(true);
    expect(queue.size).toBe(1);
    flushFrame();
    expect(frame).toHaveBeenCalledTimes(2);
    loop.stop();
  });

  it("pauses while the layer is off screen and resumes when it is back", () => {
    const frame = vi.fn();
    const loop = startDecorativeLoop(document.body, frame);
    setIntersecting(false);
    expect(loop.isRunning()).toBe(false);
    expect(queue.size).toBe(0);

    setIntersecting(true);
    expect(loop.isRunning()).toBe(true);
    flushFrame();
    expect(frame).toHaveBeenCalledTimes(2);
    loop.stop();
  });

  it("stays paused until the tab is visible and the layer on screen together", () => {
    const frame = vi.fn();
    const loop = startDecorativeLoop(document.body, frame);
    setVisibility("hidden");
    setIntersecting(false);
    setVisibility("visible");
    expect(loop.isRunning()).toBe(false);
    setVisibility("hidden");
    setIntersecting(true);
    expect(loop.isRunning()).toBe(false);
    setVisibility("visible");
    expect(loop.isRunning()).toBe(true);
    expect(queue.size).toBe(1);
    loop.stop();
  });

  it("starts paused in a hidden tab and paints once shown", () => {
    visibility = "hidden";
    const frame = vi.fn();
    const loop = startDecorativeLoop(document.body, frame);
    expect(frame).not.toHaveBeenCalled();
    expect(loop.isRunning()).toBe(false);
    setVisibility("visible");
    flushFrame();
    expect(frame).toHaveBeenCalledTimes(1);
    loop.stop();
  });

  it("stop cancels the frame and ignores later visibility changes", () => {
    const frame = vi.fn();
    const loop = startDecorativeLoop(document.body, frame);
    loop.stop();
    expect(queue.size).toBe(0);
    setVisibility("hidden");
    setVisibility("visible");
    setIntersecting(true);
    expect(queue.size).toBe(0);
    expect(loop.isRunning()).toBe(false);
  });

  it("counts the layer as on screen without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const frame = vi.fn();
    const loop = startDecorativeLoop(document.body, frame);
    expect(loop.isRunning()).toBe(true);
    flushFrame();
    expect(frame).toHaveBeenCalledTimes(2);
    loop.stop();
  });
});
