// docs/site.md sections 8.9, 8.10, and 18. The import rule of the MapLibre
// chunks against the built `dist/`: `routemap` (maplibre-gl and pmtiles)
// is imported only by `tracker-maplibre` (src/mapHost); the index chunk
// reaches `tracker-maplibre` through `import()` alone and the Map section
// chunk is the only other chunk that may import it; the index chunk
// carries none of MapLibre; and both chunks stay under their size-limit
// budgets, brotli compressed. The test is skipped when there is no build
// output.

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

function jsFiles(): string[] {
  return readdirSync(DIST_ASSETS).filter((f) => f.endsWith(".js"));
}

function read(file: string): string {
  return readFileSync(resolve(DIST_ASSETS, file), "utf8");
}

function escape(name: string): string {
  return name.replace(/\./g, "\\.");
}

function staticImport(name: string): RegExp {
  return new RegExp(`from\\s*["\`']\\./${escape(name)}["\`']`);
}

function dynamicImport(name: string): RegExp {
  return new RegExp(`import\\(\\s*["\`']\\./${escape(name)}["\`']\\s*\\)`);
}

function brotliBytes(prefix: string): number {
  return readdirSync(DIST_ASSETS)
    .filter((f) => f.startsWith(`${prefix}-`) && (f.endsWith(".js") || f.endsWith(".css")))
    .reduce((sum, f) => sum + brotliCompressSync(readFileSync(resolve(DIST_ASSETS, f))).length, 0);
}

function budget(prefix: string): number {
  const entry = (pkg as unknown as { "size-limit": { name: string; limit: string }[] })["size-limit"].find(
    (e) => e.name.startsWith(`${prefix} (`),
  );
  expect(entry, prefix).toBeDefined();
  return Number.parseFloat(entry!.limit) * 1000;
}

describe("routemap chunk", () => {
  it("is imported only by tracker-maplibre", () => {
    const routeMapPath = findChunk("routemap");
    const hostPath = findChunk("tracker-maplibre");
    if (routeMapPath === null || hostPath === null) return;
    const name = basename(routeMapPath);
    expect(read(basename(hostPath))).toMatch(staticImport(name));
    for (const f of jsFiles()) {
      if (f === name || f === basename(hostPath)) continue;
      expect(read(f).includes(`./${name}`), f).toBe(false);
    }
  });

  it("holds MapLibre, and the index chunk does not", () => {
    const indexPath = findChunk("index");
    const routeMapPath = findChunk("routemap");
    if (indexPath === null || routeMapPath === null) return;
    expect(readFileSync(routeMapPath, "utf8")).toContain("maplibregl-");
    expect(readFileSync(indexPath, "utf8")).not.toContain("maplibregl-");
  });

  it("stays under its size budget, brotli compressed", () => {
    if (findChunk("routemap") === null) return;
    const bytes = brotliBytes("routemap");
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(budget("routemap"));
  });
});

describe("tracker-maplibre chunk", () => {
  it("is reached from the index chunk through import() alone", () => {
    const indexPath = findChunk("index");
    const hostPath = findChunk("tracker-maplibre");
    if (indexPath === null || hostPath === null) return;
    const name = basename(hostPath);
    const indexJs = readFileSync(indexPath, "utf8");
    expect(indexJs).not.toMatch(staticImport(name));
    expect(indexJs).toMatch(dynamicImport(name));
  });

  it("is imported by no chunk but the index chunk and the Map section chunk", () => {
    const hostPath = findChunk("tracker-maplibre");
    if (hostPath === null) return;
    const name = basename(hostPath);
    for (const f of jsFiles()) {
      if (f === name || f.startsWith("index-") || f.startsWith("Map-")) continue;
      expect(read(f).includes(`./${name}`), f).toBe(false);
    }
  });

  it("stays under its size budget, brotli compressed", () => {
    if (findChunk("tracker-maplibre") === null) return;
    const bytes = brotliBytes("tracker-maplibre");
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(budget("tracker-maplibre"));
  });
});
