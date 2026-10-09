// docs/site.md section 18 (the routemap row). The vendored MapLibre sheet
// loads with the routemap chunk, after the host's own stylesheet, so any
// `position` it set on `.maplibregl-map` would win over the host rule's
// `position: absolute` and collapse the map frame to no height. The host
// rule positions the element; the vendored sheet must not.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MAP_HOST = resolve(__dirname, "..", "..", "..", "src", "mapHost");

function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} rule present`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("the vendored MapLibre sheet and the host rule", () => {
  it("leaves the map element's position to the host rule", () => {
    const maplibre = readFileSync(resolve(MAP_HOST, "maplibre.css"), "utf8");
    expect(rule(maplibre, ".maplibregl-map")).not.toMatch(/\bposition\s*:/);
  });

  it("positions the host over its frame", () => {
    const host = readFileSync(resolve(MAP_HOST, "MapHost.module.css"), "utf8");
    const routeMapHost = rule(host, ".routeMapHost");
    expect(routeMapHost).toMatch(/position:\s*absolute/);
    expect(routeMapHost).toMatch(/inset:\s*0/);
  });
});
