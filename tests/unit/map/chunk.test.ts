// docs/site.md sections 4 and 18. The `map` chunk (src/map: the renderer
// choice's loader, the theme loader, the Google tracker) against the built
// `dist/`: the index chunk reaches it through `import()` alone, the Map
// section chunk imports it, the route preview's host chunk
// (`tracker-maplibre`, whose Google branch draws route mode with it)
// reaches it, and nothing in `routemap` (MapLibre and PMTiles) imports it. The test is skipped when there is no build output.

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

  it("is imported by the Map section chunk", () => {
    const mapPath = findChunk("map");
    const MapPath = findChunk("Map");
    if (mapPath === null || MapPath === null) return;
    const mapChunkName = basename(mapPath);
    const importSuffix = `./${mapChunkName}`;
    const inMap = readFileSync(MapPath, "utf8").includes(importSuffix);
    expect(inMap).toBe(true);
  });

  it("is reached from the route preview's host chunk", () => {
    const mapPath = findChunk("map");
    const hostPath = findChunk("tracker-maplibre");
    if (mapPath === null || hostPath === null) return;
    expect(readFileSync(hostPath, "utf8").includes(`./${basename(mapPath)}`)).toBe(true);
  });

  it("is imported by nothing in routemap", () => {
    const mapPath = findChunk("map");
    const routeMapPath = findChunk("routemap");
    if (mapPath === null || routeMapPath === null) return;
    expect(readFileSync(routeMapPath, "utf8").includes(`./${basename(mapPath)}`)).toBe(false);
  });
});
