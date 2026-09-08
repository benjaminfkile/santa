// docs/site.md section 7.7. applyTheme sets html attributes and the favicon.

import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme } from "../../../../src/content/theme/applyTheme";
import type { ContentBundle } from "../../../../src/store/types";

function bundleWithIcon(): ContentBundle {
  return {
    content: null as unknown as ContentBundle["content"],
    icons: { "santa-hat": "https://cdn/icons/santa-hat.svg" },
    media: {
      "avatar-1": {
        url: "https://cdn/media/avatar.png",
        kind: "raster",
        width: 32,
        height: 32,
        alt: "",
        variants: {},
      },
    },
  };
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-accent");
  document.documentElement.removeAttribute("data-surface");
  document.documentElement.removeAttribute("data-fonts");
  document.head
    .querySelectorAll('link[rel="icon"]')
    .forEach((el) => el.remove());
});

describe("applyTheme", () => {
  it.each([
    ["red", "night", "festive"],
    ["green", "snow", "classic"],
    ["gold", "forest", "modern"],
    ["blue", "night", "modern"],
  ] as const)("sets html attributes for %s / %s / %s", (accent, surface, fontPairing) => {
    applyTheme({
      theme: { accent, surface, fontPairing },
      favicon: null,
      bundle: bundleWithIcon(),
    });
    expect(document.documentElement.getAttribute("data-accent")).toBe(accent);
    expect(document.documentElement.getAttribute("data-surface")).toBe(surface);
    expect(document.documentElement.getAttribute("data-fonts")).toBe(fontPairing);
  });

  it("swaps the favicon href to the resolved library icon URL", () => {
    applyTheme({
      theme: { accent: "red", surface: "night", fontPairing: "festive" },
      favicon: { source: "library", id: "santa-hat" },
      bundle: bundleWithIcon(),
    });
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(link?.getAttribute("href")).toBe("https://cdn/icons/santa-hat.svg");
  });

  it("falls back to /favicon.svg when the icon cannot be resolved", () => {
    applyTheme({
      theme: { accent: "red", surface: "night", fontPairing: "festive" },
      favicon: { source: "library", id: "does-not-exist" },
      bundle: bundleWithIcon(),
    });
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(link?.getAttribute("href")).toBe("/favicon.svg");
  });

  it("resolves a media favicon", () => {
    applyTheme({
      theme: { accent: "red", surface: "night", fontPairing: "festive" },
      favicon: { source: "media", id: "avatar-1" },
      bundle: bundleWithIcon(),
    });
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(link?.getAttribute("href")).toBe("https://cdn/media/avatar.png");
  });
});
