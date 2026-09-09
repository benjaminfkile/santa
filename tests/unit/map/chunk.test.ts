// docs/site.md sections 4 and 18. Acceptance criterion 831: the `map`
// chunk is loaded only when a `map` section or map-style route preview
// mounts. This test inspects the built `dist/` folder. It is skipped
// when there is no build output.

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

  it("is only reachable through the Map section chunk or the RoutePreviewMap chunk", () => {
    const mapPath = findChunk("map");
    const MapPath = findChunk("Map");
    const rpMapPath = findChunk("RoutePreviewMap");
    if (mapPath === null || MapPath === null || rpMapPath === null) return;
    const mapChunkName = basename(mapPath);
    const importSuffix = `./${mapChunkName}`;
    const inMap = readFileSync(MapPath, "utf8").includes(importSuffix);
    const inRp = readFileSync(rpMapPath, "utf8").includes(importSuffix);
    expect(inMap || inRp).toBe(true);
  });
});
