// docs/site.md sections 4 and 18. The `map` chunk is loaded only when a
// `map` section mounts — the `route_preview` styles (`image`, `viewer`)
// never import it. This test inspects the built `dist/` folder. It is
// skipped when there is no build output.

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const DIST_ASSETS = resolve(__dirname, "..", "..", "..", "dist", "assets");

function findChunk(prefix: string): string | null {
  if (!existsSync(DIST_ASSETS)) return null;
  const files = readdirSync(DIST_ASSETS);
  const match = files.find((f) => f.startsWith(`${prefix}-`) && f.endsWith(".js"));
  return match ? resolve(DIST_ASSETS, match) : null;
}

describe("map chunk", () => {
  it("is not statically imported by the index chunk", () => {
    const indexPath = findChunk("index");
    const mapPath = findChunk("map");
    if (indexPath === null || mapPath === null) {
      // No build to inspect; skip.
      return;
    }
    const indexJs = readFileSync(indexPath, "utf8");
    const mapChunkName = basename(mapPath);
    // A static import would look like: from"./map-XXXX.js"
    const staticImport = new RegExp(`from\\s*["\`']\\./${mapChunkName.replace(/\./g, "\\.")}["\`']`);
    expect(indexJs).not.toMatch(staticImport);
  });

  it("is only reachable through the Map section chunk", () => {
    const mapPath = findChunk("map");
    const MapPath = findChunk("Map");
    if (mapPath === null || MapPath === null) return;
    const mapChunkName = basename(mapPath);
    const importSuffix = `./${mapChunkName}`;
    const inMap = readFileSync(MapPath, "utf8").includes(importSuffix);
    expect(inMap).toBe(true);
  });

  it("is not referenced by any chunk that carries RoutePreview code", () => {
    const mapPath = findChunk("map");
    if (mapPath === null) return;
    const mapChunkName = basename(mapPath);
    if (!existsSync(DIST_ASSETS)) return;
    const files = readdirSync(DIST_ASSETS).filter((f) => f.endsWith(".js"));
    for (const f of files) {
      const contents = readFileSync(resolve(DIST_ASSETS, f), "utf8");
      if (!contents.includes("route_preview")) continue;
      // The Map section chunk lists it as a supported kind too; skip that one.
      if (f.startsWith("Map-")) continue;
      expect(contents.includes(`./${mapChunkName}`)).toBe(false);
    }
  });
});
