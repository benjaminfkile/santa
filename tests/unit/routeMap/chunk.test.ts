// docs/site.md sections 8.9 and 18. The `routemap` chunk (maplibre-gl,
// pmtiles, @protomaps/basemaps, src/routeMap) is loaded only when a
// `map`-style route_preview mounts: the index chunk reaches it through a
// dynamic import alone and carries none of MapLibre. This test inspects
// the built `dist/` folder. It is skipped when there is no build output.

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

describe("routemap chunk", () => {
  it("is not statically imported by the index chunk", () => {
    const indexPath = findChunk("index");
    const routeMapPath = findChunk("routemap");
    if (indexPath === null || routeMapPath === null) return;
    const indexJs = readFileSync(indexPath, "utf8");
    const name = basename(routeMapPath).replace(/\./g, "\\.");
    expect(indexJs).not.toMatch(new RegExp(`from\\s*["\`']\\./${name}["\`']`));
    expect(indexJs).toMatch(new RegExp(`import\\(\\s*["\`']\\./${name}["\`']\\s*\\)`));
  });

  it("holds MapLibre, and the index chunk does not", () => {
    const indexPath = findChunk("index");
    const routeMapPath = findChunk("routemap");
    if (indexPath === null || routeMapPath === null) return;
    expect(readFileSync(routeMapPath, "utf8")).toContain("maplibregl-");
    expect(readFileSync(indexPath, "utf8")).not.toContain("maplibregl-");
  });

  it("is not imported by any other chunk", () => {
    const routeMapPath = findChunk("routemap");
    if (routeMapPath === null) return;
    const name = basename(routeMapPath);
    for (const f of readdirSync(DIST_ASSETS).filter((x) => x.endsWith(".js"))) {
      if (f === name || f.startsWith("index-")) continue;
      expect(readFileSync(resolve(DIST_ASSETS, f), "utf8").includes(`./${name}`), f).toBe(false);
    }
  });
});
