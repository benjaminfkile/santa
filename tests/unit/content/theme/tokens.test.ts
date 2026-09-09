// docs/site.md section 7.7. The theme tokens follow the approved wireframe:
// surface snow, accent red, and font pairing festive reproduce the palette,
// typography, and self-hosted Patrick Hand from docs/wireframes/Main.dc.html.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = resolve(here, "../../../../src/content/theme/tokens.css");
const css = readFileSync(tokensPath, "utf8");

function block(selector: string): string {
  const index = css.indexOf(selector);
  if (index === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", index);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function customProperty(body: string, name: string): string {
  const line = body
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}:`));
  if (!line) throw new Error(`property not found: ${name}`);
  return line.slice(name.length + 1).replace(/;$/, "").trim();
}

describe("theme tokens.css", () => {
  it("uses the snow surface values from the wireframe", () => {
    const body = block('html[data-surface="snow"]');
    expect(customProperty(body, "--wmsfo-surface")).toBe("#fbfaf8");
    expect(customProperty(body, "--wmsfo-surface-muted")).toBe("#f6f5f2");
    expect(customProperty(body, "--wmsfo-surface-strong")).toBe("#ecebe7");
    expect(customProperty(body, "--wmsfo-text")).toBe("#141413");
    expect(customProperty(body, "--wmsfo-text-muted")).toBe("#8a877f");
    expect(customProperty(body, "--wmsfo-border")).toBe("#d6d3cc");
  });

  it("uses the red accent values from the wireframe", () => {
    const body = block('html[data-accent="red"]');
    expect(customProperty(body, "--wmsfo-accent")).toBe("#c9452e");
    expect(customProperty(body, "--wmsfo-accent-contrast")).toBe("#ffffff");
  });

  it("uses the festive font pairing with the wireframe fallbacks", () => {
    const body = block('html[data-fonts="festive"]');
    const stack = '"Patrick Hand", "Segoe Print", "Comic Sans MS", cursive';
    expect(customProperty(body, "--wmsfo-heading-font")).toBe(stack);
    expect(customProperty(body, "--wmsfo-body-font")).toBe(stack);
  });

  it("sets the wireframe base font size and line height", () => {
    const root = block(":root");
    expect(customProperty(root, "--wmsfo-font-size-base")).toBe("18px");
    expect(customProperty(root, "--wmsfo-line-height-base")).toBe("1.3");
  });

  it("self-hosts Patrick Hand as a woff2 with font-display: swap", () => {
    const faceIndex = css.indexOf("@font-face");
    expect(faceIndex).toBeGreaterThan(-1);
    const face = css.slice(faceIndex, css.indexOf("}", faceIndex));
    expect(face).toMatch(/font-family:\s*"Patrick Hand"/);
    expect(face).toMatch(/font-display:\s*swap/);
    expect(face).toMatch(/\/fonts\/PatrickHand-Regular\.woff2/);
    expect(face).toMatch(/format\("woff2"\)/);
  });
});
