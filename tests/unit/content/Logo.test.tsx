// docs/site.md section 7.3. Logo draws the site settings logoMedia by
// height, uncropped, with its alt from the MediaRef, the asset, or the site
// name, and renders nothing without a logo.

import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Logo } from "../../../src/content/Logo";
import type { ContentBundle } from "../../../src/store/types";

afterEach(cleanup);

function makeBundle(logoMedia: unknown, assetAlt: string | null = "Asset alt"): ContentBundle {
  return {
    content: { settings: { siteName: "Site Name", logoMedia } } as unknown as ContentBundle["content"],
    media: {
      logo: {
        url: "https://cdn/logo.png",
        kind: "raster",
        width: 800,
        height: 200,
        alt: assetAlt,
        variants: { "480": "https://cdn/logo-480.webp" },
      },
    } as unknown as ContentBundle["media"],
    icons: {},
  };
}

describe("Logo", () => {
  it("renders nothing without logoMedia", () => {
    const { container } = render(<Logo bundle={makeBundle(null)} height={40} />);
    expect(container.innerHTML).toBe("");
    const { container: absent } = render(<Logo bundle={makeBundle(undefined)} height={40} />);
    expect(absent.innerHTML).toBe("");
  });

  it("draws the image at the given height with no width set", () => {
    const { getByTestId } = render(<Logo bundle={makeBundle({ mediaId: "logo", alt: null })} height={40} />);
    const box = getByTestId("site-logo");
    expect(box.style.height).toBe("40px");
    expect(box.style.width).toBe("");
    const img = box.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn/logo.png");
    expect(img.getAttribute("srcset")).toContain("https://cdn/logo-480.webp 480w");
  });

  it("takes the alt from the MediaRef first", () => {
    const { getByRole } = render(<Logo bundle={makeBundle({ mediaId: "logo", alt: "Ref alt" })} height={40} />);
    expect(getByRole("img").getAttribute("alt")).toBe("Ref alt");
  });

  it("falls back to the asset's alt", () => {
    const { getByRole } = render(<Logo bundle={makeBundle({ mediaId: "logo", alt: null })} height={40} />);
    expect(getByRole("img").getAttribute("alt")).toBe("Asset alt");
  });

  it("falls back to the site name when neither alt is set", () => {
    const { getByRole } = render(<Logo bundle={makeBundle({ mediaId: "logo", alt: null }, null)} height={40} />);
    expect(getByRole("img").getAttribute("alt")).toBe("Site Name");
    cleanup();
    const { getByRole: byRole } = render(<Logo bundle={makeBundle({ mediaId: "logo", alt: "" }, "")} height={40} />);
    expect(byRole("img").getAttribute("alt")).toBe("Site Name");
  });

  it("styles the image uncropped with the width following the height", () => {
    const css = readFileSync(resolve(__dirname, "..", "..", "..", "src", "content", "Logo.module.css"), "utf8");
    expect(css).toMatch(/\.logo img \{[^}]*height: 100%;[^}]*width: auto;[^}]*object-fit: contain;/);
    expect(css).not.toMatch(/border-radius|object-fit: cover/);
  });
});
