// docs/site.md section 7.3. resolveIcon returns the smallest variant
// (the `480` key when present) for a raster media entry, and falls back
// to `url` for svg and gif entries and for a raster entry without
// variants. Library icons look up the id in `bundle.icons`.

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { resolveIcon, _resetResolveLogs } from "../../../../src/content/primitives/resolve";
import type { ContentBundle } from "../../../../src/store/types";

function makeBundle(): ContentBundle {
  return {
    content: null as unknown as ContentBundle["content"],
    icons: { star: "https://cdn/icons/star.svg" },
    media: {
      raster: {
        url: "https://cdn/full.jpg",
        kind: "raster",
        width: 1200,
        height: 800,
        alt: "raster",
        variants: {
          "480": "https://cdn/w480.webp",
          "960": "https://cdn/w960.webp",
          "1600": "https://cdn/w1600.webp",
        },
      },
      rasterNoVariants: {
        url: "https://cdn/plain.jpg",
        kind: "raster",
        width: 400,
        height: 200,
        alt: "plain",
        variants: {},
      },
      svg: {
        url: "https://cdn/thing.svg",
        kind: "svg",
        width: null,
        height: null,
        alt: "svg",
        variants: { "480": "https://cdn/should-not-use.webp" },
      },
      gif: {
        url: "https://cdn/thing.gif",
        kind: "gif",
        width: 100,
        height: 100,
        alt: "gif",
        variants: { "480": "https://cdn/should-not-use.webp" },
      },
    },
  };
}

beforeEach(() => {
  _resetResolveLogs();
});

afterEach(() => {
  _resetResolveLogs();
});

describe("resolveIcon", () => {
  it("returns the 480 variant for a raster media entry", () => {
    const bundle = makeBundle();
    const result = resolveIcon(bundle, { source: "media", id: "raster" });
    expect(result).toBe("https://cdn/w480.webp");
  });

  it("falls back to url for a raster media entry without variants", () => {
    const bundle = makeBundle();
    const result = resolveIcon(bundle, { source: "media", id: "rasterNoVariants" });
    expect(result).toBe("https://cdn/plain.jpg");
  });

  it("returns url for an svg media entry even when variants are set", () => {
    const bundle = makeBundle();
    const result = resolveIcon(bundle, { source: "media", id: "svg" });
    expect(result).toBe("https://cdn/thing.svg");
  });

  it("returns url for a gif media entry even when variants are set", () => {
    const bundle = makeBundle();
    const result = resolveIcon(bundle, { source: "media", id: "gif" });
    expect(result).toBe("https://cdn/thing.gif");
  });

  it("returns the library url for a library icon and null for an unknown id", () => {
    const bundle = makeBundle();
    expect(resolveIcon(bundle, { source: "library", id: "star" })).toBe(
      "https://cdn/icons/star.svg",
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveIcon(bundle, { source: "library", id: "missing" })).toBeNull();
    warn.mockRestore();
  });
});
