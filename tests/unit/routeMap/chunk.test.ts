// docs/site.md sections 8.9 and 18. The `routemap` chunk (maplibre-gl,
// pmtiles, @protomaps/basemaps, src/routeMap) is loaded only when a
// `map`-style route_preview mounts: the index chunk reaches it through a
// dynamic import alone and carries none of MapLibre, and its scripts and
// styles together stay under the size-limit budget in package.json,
// brotli compressed. This test inspects the built `dist/` folder. It is
// skipped when there is no build output.

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { brotliCompressSync } from "node:zlib";
import pkg from "../../../package.json";

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

  it("stays under its size budget, brotli compressed", () => {
    if (findChunk("routemap") === null) return;
    const entry = (pkg as unknown as { "size-limit": { name: string; limit: string }[] })[
      "size-limit"
    ].find((e) => e.name.startsWith("routemap ("));
    expect(entry).toBeDefined();
    const limitBytes = Number.parseFloat(entry!.limit) * 1000;
    const files = readdirSync(DIST_ASSETS).filter(
      (f) => f.startsWith("routemap-") && (f.endsWith(".js") || f.endsWith(".css")),
    );
    const bytes = files.reduce(
      (sum, f) => sum + brotliCompressSync(readFileSync(resolve(DIST_ASSETS, f))).length,
      0,
    );
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(limitBytes);
  });
});
