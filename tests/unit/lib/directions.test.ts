// docs/site.md section 8.9. The "Get directions" target of a viewpoint:
// Apple Maps on an Apple touch device (an iPhone, iPad, or iPod user
// agent, or a Macintosh one with touch points), Google Maps directions
// everywhere else, each with the point as latitude,longitude.

import { describe, it, expect } from "vitest";
import { directionsHref, isAppleTouch } from "../../../src/lib/directions";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("directionsHref", () => {
  it("opens Apple Maps on an Apple touch device", () => {
    for (const platform of [
      { userAgent: IPHONE, maxTouchPoints: 5 },
      { userAgent: IPAD, maxTouchPoints: 5 },
      { userAgent: MAC, maxTouchPoints: 5 },
    ]) {
      expect(isAppleTouch(platform)).toBe(true);
      expect(directionsHref(46.8721, -113.994, platform)).toBe(
        "https://maps.apple.com/?daddr=46.8721,-113.994",
      );
    }
  });

  it("opens Google Maps directions everywhere else, a Mac without touch included", () => {
    for (const platform of [
      { userAgent: MAC, maxTouchPoints: 0 },
      { userAgent: ANDROID, maxTouchPoints: 5 },
      { userAgent: WINDOWS, maxTouchPoints: 0 },
      { userAgent: "", maxTouchPoints: 0 },
    ]) {
      expect(isAppleTouch(platform)).toBe(false);
      expect(directionsHref(46.8721, -113.994, platform)).toBe(
        "https://www.google.com/maps/dir/?api=1&destination=46.8721,-113.994",
      );
    }
  });
});
