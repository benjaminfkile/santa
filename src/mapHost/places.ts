// docs/site.md section 8.10 (Places). The place filter on a MapLibre
// theme: PLACE_KINDS maps each of the nine tracker kinds of `POI_KINDS`
// (poiStyles.ts) to the Protomaps `kind` values it shows. Every layer whose
// `metadata` carries `"wmsfo:places": true` takes the filter
// `["all", <the layer's own filter, when it has one>, ["in", ["get", "kind"],
// ["literal", kinds]]]`, so the layer's own rules (a zoom rule, say) still
// hold. A null or empty list, or a list with no known kind, sets
// `visibility: "none"` on those layers. A theme with no marked layer shows
// no places whatever the list. `applyPlaces` returns a new style and never
// changes the one it is given; the host keeps each theme's own style and
// builds every filter from it, so a layer's original filter is the one
// every change starts from.

import type { FilterSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import { POI_KINDS, type PoiKind } from "../map/poiStyles";

export const PLACES_METADATA = "wmsfo:places";

export const PLACE_KINDS: Readonly<Record<PoiKind, readonly string[]>> = {
  attraction: [
    "attraction", "museum", "zoo", "aquarium", "theme_park", "artwork", "viewpoint",
    "castle", "monument", "memorial", "theatre", "cinema", "gallery",
  ],
  business: [
    "shop", "supermarket", "convenience", "marketplace", "mall", "department_store",
    "restaurant", "cafe", "fast_food", "bar", "pub", "bakery", "hotel", "bank",
    "books", "clothes", "beauty", "car",
  ],
  government: [
    "townhall", "courthouse", "police", "fire_station", "post_office", "embassy",
    "government", "prison",
  ],
  medical: ["hospital", "clinic", "doctors", "dentist", "pharmacy", "veterinary"],
  park: [
    "park", "garden", "nature_reserve", "national_park", "forest", "protected_area",
    "playground", "picnic_site", "camp_site", "beach", "peak",
  ],
  place_of_worship: ["place_of_worship"],
  school: ["school", "college", "university", "kindergarten", "library"],
  sports_complex: [
    "sports_centre", "stadium", "pitch", "golf_course", "swimming_pool",
    "fitness_centre", "ice_rink", "marina",
  ],
  transit: [
    "station", "bus_stop", "bus_station", "ferry_terminal", "aerodrome", "airport",
    "subway_station", "train_station", "tram_stop",
  ],
};

// The Protomaps kinds of the known tracker kinds in the list, in table order.
export function protomapsKinds(kinds: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const kind of POI_KINDS) {
    if (kinds?.includes(kind)) out.push(...PLACE_KINDS[kind]);
  }
  return out;
}

function isPlacesLayer(layer: LayerSpecification): boolean {
  const metadata = layer.metadata as Record<string, unknown> | undefined;
  return metadata?.[PLACES_METADATA] === true;
}

export function applyPlaces(
  style: StyleSpecification,
  kinds: readonly string[] | null | undefined,
): StyleSpecification {
  if (!style.layers.some(isPlacesLayer)) return style;
  const protomaps = protomapsKinds(kinds);
  const layers = style.layers.map((layer): LayerSpecification => {
    if (!isPlacesLayer(layer)) return layer;
    if (protomaps.length === 0) {
      return { ...layer, layout: { ...layer.layout, visibility: "none" } } as LayerSpecification;
    }
    const byKind: FilterSpecification = ["in", ["get", "kind"], ["literal", protomaps]];
    const own = "filter" in layer ? layer.filter : undefined;
    const filter = (own !== undefined ? ["all", own, byKind] : ["all", byKind]) as FilterSpecification;
    return { ...layer, filter } as LayerSpecification;
  });
  return { ...style, layers };
}
