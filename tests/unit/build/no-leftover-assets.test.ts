// docs/site.md section 2 and S18. The starter files that ship with the
// Vite React template should not be checked in. The site's only image
// assets live in the content bundle (media served through the CDN);
// nothing under src/assets or public/ is site-coded except the favicon,
// the web manifest, robots.txt, and the tracker's six style thumbnails.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

const banned = [
  "public/icons.svg",
  "src/assets/hero.png",
  "src/assets/react.svg",
  "src/assets/vite.svg",
  "src/assets",
];

const required = [
  "public/favicon.svg",
  "public/robots.txt",
  "public/manifest.webmanifest",
  "public/tracker-themes/standard.png",
  "public/tracker-themes/expedition.png",
  "public/tracker-themes/blizzard.png",
  "public/tracker-themes/charcoal.png",
  "public/tracker-themes/night.png",
  "public/tracker-themes/nebula.png",
];

describe("static assets", () => {
  it("no leftover starter/removed assets remain in the repo", () => {
    const remaining = banned.filter((p) => existsSync(resolve(repoRoot, p)));
    expect(remaining).toEqual([]);
  });

  it("the site-coded static assets are in place", () => {
    const missing = required.filter((p) => !existsSync(resolve(repoRoot, p)));
    expect(missing).toEqual([]);
  });
});
