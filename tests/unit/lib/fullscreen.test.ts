// docs/site.md sections 8.5 and 8.9. `fullscreenSupported` takes only the
// unprefixed element API, so the webkit flag alone (iPhone Safari) reads
// as unsupported; `lockBodyScroll` holds the body until its last lock is
// released and restores what was there.

import { describe, it, expect, afterEach } from "vitest";
import { fullscreenSupported, lockBodyScroll } from "../../../src/lib/fullscreen";

type Loose = Record<string, unknown>;

afterEach(() => {
  delete (document as unknown as Loose).fullscreenEnabled;
  delete (document as unknown as Loose).webkitFullscreenEnabled;
  delete (HTMLElement.prototype as unknown as Loose).requestFullscreen;
  delete (HTMLElement.prototype as unknown as Loose).webkitRequestFullscreen;
  document.body.style.overflow = "";
});

describe("fullscreenSupported", () => {
  it("is false with only the webkit flag and the prefixed call", () => {
    Object.defineProperty(document, "webkitFullscreenEnabled", { configurable: true, value: true });
    (HTMLElement.prototype as unknown as Loose).webkitRequestFullscreen = () => {};
    expect(fullscreenSupported(document.createElement("div"))).toBe(false);
  });

  it("is false with the flag but no element request", () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    expect(fullscreenSupported(document.createElement("div"))).toBe(false);
  });

  it("is true with the unprefixed flag and element request", () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    (HTMLElement.prototype as unknown as Loose).requestFullscreen = async () => {};
    expect(fullscreenSupported(document.createElement("div"))).toBe(true);
  });
});

describe("lockBodyScroll", () => {
  it("restores the body once every lock is released, each release counting once", () => {
    document.body.style.overflow = "auto";
    const first = lockBodyScroll();
    const second = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
    first();
    first();
    expect(document.body.style.overflow).toBe("hidden");
    second();
    expect(document.body.style.overflow).toBe("auto");
  });
});
