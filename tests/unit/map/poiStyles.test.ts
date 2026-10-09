// docs/site.md sections 8.2 and 8.4. The place filter's style array: the
// theme's rules first and unchanged, then one visibility-off rule per kind
// left out; no filter returns the theme's array itself.

import { describe, it, expect } from "vitest";
import { POI_KINDS, poiStyles, resolvePoiKinds } from "../../../src/map/poiStyles";
import { seededStyle } from "./themeFixtures";

const base = seededStyle("standard");

describe("poiStyles", () => {
  it("keeps the theme's rules first and unchanged", () => {
    const out = poiStyles(base, { kinds: ["park"] });
    expect(out.slice(0, base.length)).toEqual(base);
    out.slice(0, base.length).forEach((r, i) => expect(r).toBe(base[i]));
  });

  it("a filter of two kinds appends an off rule for each of the other seven", () => {
    const out = poiStyles(base, { kinds: ["park", "school"] });
    expect(out.slice(base.length)).toEqual([
      { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
      { featureType: "poi.business", stylers: [{ visibility: "off" }] },
      { featureType: "poi.government", stylers: [{ visibility: "off" }] },
      { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
      { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
      { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
    ]);
  });

  it("a filter of every kind appends nothing", () => {
    expect(poiStyles(base, { kinds: [...POI_KINDS] })).toEqual(base);
  });

  it("no filter returns the theme's array itself", () => {
    expect(poiStyles(base, null)).toBe(base);
  });
});

describe("resolvePoiKinds", () => {
  it("drops unknown strings and duplicates", () => {
    expect(resolvePoiKinds(["park", "zoo", "park", "transit"])).toEqual(["park", "transit"]);
    expect(resolvePoiKinds(undefined)).toEqual([]);
  });
});
