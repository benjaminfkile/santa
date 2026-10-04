// docs/site.md section 7.7. Each theme root declares its `color-scheme`,
// so native controls and the page scrollbar follow the theme.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "../../../../src/content/theme/tokens.css"), "utf8");

function rootBody(theme: "light" | "dark"): string {
  const open = css.indexOf(`:root[data-theme="${theme}"] {`);
  if (open === -1) throw new Error(`no ${theme} root`);
  return css.slice(open, css.indexOf("}", open));
}

describe("tokens.css color-scheme", () => {
  it("declares color-scheme: light on the light root", () => {
    expect(rootBody("light")).toMatch(/^\s*color-scheme:\s*light;/m);
  });

  it("declares color-scheme: dark on the dark root", () => {
    expect(rootBody("dark")).toMatch(/^\s*color-scheme:\s*dark;/m);
  });
});
